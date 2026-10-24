import type { Prisma } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import type {
  EyewitnessLobbyView,
  EyewitnessPlayerView,
  GameActionResponse,
} from '@wanasatna/shared';
import {
  EYEWITNESS_ADVANCE_EVENT,
  EYEWITNESS_CLEAR_CANVAS_EVENT,
  EYEWITNESS_CONFIRM_VOTE_EVENT,
  EYEWITNESS_GAME_ID,
  EYEWITNESS_LOBBY_SYNC_EVENT,
  EYEWITNESS_MIN_PLAYERS,
  EYEWITNESS_PHASE_CHANGED_EVENT,
  EYEWITNESS_STROKE_EVENT,
  EYEWITNESS_STROKE_POINTS_EVENT,
  EYEWITNESS_SUBMIT_ARTWORK_EVENT,
  EYEWITNESS_SUBMIT_DESCRIPTION_EVENT,
  EYEWITNESS_SYNC_EVENT,
  EYEWITNESS_UNDO_EVENT,
  EYEWITNESS_UPDATE_DESCRIPTION_EVENT,
  EYEWITNESS_UPDATE_SETTINGS_EVENT,
} from '@wanasatna/shared';
import { prisma } from '../../../../lib/prisma.js';
import { resolveSocketAccountUser } from '../../../auth/socket-auth.js';
import { getRoomChannel, loadActiveRoomPlayers } from '../../../room/room.utils.js';
import { lockRoomRow } from '../../../room/services/room-tx.js';
import { assertGameShellHost, getGameShellByRoomId, syncGameShell } from '../../game.service.js';
import {
  getGameSocketContext,
  rejectIfGameSyncRateLimited,
  sendGameInternalError,
  sendGameResponse,
} from '../../game.socket.utils.js';
import {
  DRAW_GUESS_BOARD_LIMITS,
  processStrokeCommand,
  processStrokePointsCommand,
} from '../../runtime/drawing-strokes.js';
import {
  authorizeExperimentalGameStartLocked,
  preflightExperimentalGameStart,
} from '../experimental-game-access.service.js';
import {
  getExperimentalGameSelection,
  hydrateExperimentalGameSelection,
} from '../experimental-game-selection.store.js';
import { ensureEyewitnessMatch } from './init-match.js';
import {
  getEyewitnessLobbySettings,
  hydrateEyewitnessLobbySettings,
  persistEyewitnessSettings,
  setEyewitnessLobbySettings,
  validateEyewitnessSettings,
} from './lobby-settings.js';
import {
  advanceEyewitnessAtBoundary,
  reconcileEyewitnessConnectivity,
  restartEyewitnessTimer,
  settleEyewitnessDeadline,
} from './phase-timer.js';
import {
  buildEyewitnessPlayerView,
  confirmEyewitnessVote,
  submitEyewitnessArtwork,
  submitEyewitnessDescription,
  updateEyewitnessArtworkStrokes,
  updateEyewitnessDescription,
} from './state.js';
import { getEyewitnessMatch, setEyewitnessMatch } from './store.js';

type ViewResponse = GameActionResponse<{ view: EyewitnessPlayerView }>;

const strokeWindows = new WeakMap<Socket, { startedAt: number; count: number }>();
const STROKE_EVENT_LIMIT_PER_SECOND = 80;

function invalid(message: string): Extract<GameActionResponse<never>, { success: false }> {
  return { success: false, error: { code: 'VALIDATION_ERROR', message } };
}

function forbidden(message: string): Extract<GameActionResponse<never>, { success: false }> {
  return { success: false, error: { code: 'FORBIDDEN', message } };
}

function exactObjectKeys(payload: unknown, allowed: readonly string[]): boolean {
  return (
    Boolean(payload) &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    Object.keys(payload as object).length === allowed.length &&
    Object.keys(payload as object).every((key) => allowed.includes(key))
  );
}

function allowStrokeEvent(socket: Socket): boolean {
  const now = Date.now();
  const current = strokeWindows.get(socket);
  if (!current || now - current.startedAt >= 1_000) {
    strokeWindows.set(socket, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= STROKE_EVENT_LIMIT_PER_SECOND;
}

function validRequestId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 100;
}

function broadcastChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(EYEWITNESS_PHASE_CHANGED_EVENT, {});
}

async function loadLobbyContext(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostPlayerId: true, gameSettings: true },
  });
  if (!room) return null;
  hydrateExperimentalGameSelection(roomId, room.gameSettings);
  hydrateEyewitnessLobbySettings(roomId, room.gameSettings);
  const players = await loadActiveRoomPlayers(roomId, room.hostPlayerId);
  return { room, players };
}

async function buildLobbyView(socket: Socket): Promise<EyewitnessLobbyView | null> {
  const roomId = socket.data.roomId as string;
  const playerId = socket.data.playerId as string;
  const context = await loadLobbyContext(roomId);
  if (!context || getExperimentalGameSelection(roomId)?.gameId !== EYEWITNESS_GAME_ID) return null;
  const account = await resolveSocketAccountUser(socket);
  const denied = await preflightExperimentalGameStart({
    roomId,
    playerId,
    gameId: EYEWITNESS_GAME_ID,
    authority: { accountUserId: account?.id ?? null, accountRole: account?.role ?? null },
  });
  return {
    gameId: EYEWITNESS_GAME_ID,
    settings: getEyewitnessLobbySettings(roomId),
    canEditSettings: denied === null && getGameShellByRoomId(roomId) === null,
    participantCount: context.players.filter(
      (player) => player.status === 'CONNECTED' && !player.isSpectator,
    ).length,
    minPlayers: EYEWITNESS_MIN_PLAYERS,
  };
}

async function respondLobbyView(
  socket: Socket,
  callback: ((response: GameActionResponse<{ view: EyewitnessLobbyView }>) => void) | undefined,
): Promise<void> {
  const view = await buildLobbyView(socket);
  if (!view) {
    sendGameResponse(callback, forbidden('هذه الغرفة ليست جلسة اختبار معتمدة للعبة.'));
    return;
  }
  sendGameResponse(callback, { success: true, data: { view } });
}

async function currentView(
  io: Server,
  roomId: string,
  playerId: string,
): Promise<EyewitnessPlayerView | null> {
  settleEyewitnessDeadline(io, roomId);
  await syncGameShell(roomId);
  const shell = getGameShellByRoomId(roomId);
  let match = getEyewitnessMatch(roomId) ?? ensureEyewitnessMatch(io, roomId);
  if (!shell || shell.gameId !== EYEWITNESS_GAME_ID || !match) return null;
  reconcileEyewitnessConnectivity(io, roomId);
  match = getEyewitnessMatch(roomId) ?? match;
  return buildEyewitnessPlayerView(match, playerId, shell);
}

async function respondView(
  io: Server,
  roomId: string,
  playerId: string,
  callback: ((response: ViewResponse) => void) | undefined,
): Promise<void> {
  const view = await currentView(io, roomId, playerId);
  if (!view) {
    sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    return;
  }
  sendGameResponse(callback, { success: true, data: { view } });
}

async function updatePersistedSettings(
  socket: Socket,
  settings: ReturnType<typeof getEyewitnessLobbySettings>,
): Promise<Extract<GameActionResponse<never>, { success: false }> | null> {
  const roomId = socket.data.roomId!;
  const playerId = socket.data.playerId!;
  const account = await resolveSocketAccountUser(socket);
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (!(await lockRoomRow(tx, roomId))) return invalid('الغرفة غير موجودة.');
    const denied = await authorizeExperimentalGameStartLocked(tx, {
      roomId,
      playerId,
      gameId: EYEWITNESS_GAME_ID,
      authority: { accountUserId: account?.id ?? null, accountRole: account?.role ?? null },
    });
    if (denied) return denied;
    if (getGameShellByRoomId(roomId)) return invalid('لا يمكن تعديل الإعدادات بعد بدء المباراة.');
    const room = await tx.room.findUnique({
      where: { id: roomId },
      select: { gameSettings: true },
    });
    if (!room) return invalid('الغرفة غير موجودة.');
    await tx.room.update({
      where: { id: roomId },
      data: { gameSettings: persistEyewitnessSettings(room.gameSettings, settings) },
    });
    return null;
  });
  if (!result) setEyewitnessLobbySettings(roomId, settings);
  return result;
}

function drawingContext(socket: Socket) {
  const roomId = socket.data.roomId!;
  const playerId = socket.data.playerId!;
  const match = getEyewitnessMatch(roomId);
  const shell = getGameShellByRoomId(roomId);
  if (!match || !shell || shell.gameId !== EYEWITNESS_GAME_ID || shell.phase !== 'PLAYING')
    return { error: invalid('اللعبة غير جاهزة بعد.') } as const;
  const artwork = match.round.artworksByPlayerId[playerId];
  if (
    match.round.phase !== 'drawing' ||
    !artwork ||
    artwork.submitted ||
    match.departedPlayerIds.includes(playerId)
  )
    return { error: forbidden('لا يمكنك تعديل رسمة في هذه المرحلة.') } as const;
  return { roomId, playerId, match, shell, artwork } as const;
}

function mapStrokeError(): Extract<GameActionResponse<never>, { success: false }> {
  return invalid('بيانات الرسم غير صالحة أو تجاوزت الحدود المسموحة.');
}

export function registerEyewitnessSocketHandlers(io: Server, socket: Socket): void {
  socket.on(EYEWITNESS_LOBBY_SYNC_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, []))
      return sendGameResponse(callback, invalid('طلب المزامنة غير صالح.'));
    if (rejectIfGameSyncRateLimited(socket, callback)) return;
    try {
      await respondLobbyView(socket, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(EYEWITNESS_UPDATE_SETTINGS_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    const parsed = validateEyewitnessSettings(payload);
    if (!parsed.success) return sendGameResponse(callback, invalid(parsed.error));
    try {
      const error = await updatePersistedSettings(socket, parsed.data);
      if (error) return sendGameResponse(callback, error);
      broadcastChanged(io, socket.data.roomId!);
      await respondLobbyView(socket, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(EYEWITNESS_SYNC_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, []))
      return sendGameResponse(callback, invalid('طلب المزامنة غير صالح.'));
    if (rejectIfGameSyncRateLimited(socket, callback)) return;
    try {
      await respondView(io, socket.data.roomId!, socket.data.playerId!, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  for (const [event, submit] of [
    [EYEWITNESS_UPDATE_DESCRIPTION_EVENT, false],
    [EYEWITNESS_SUBMIT_DESCRIPTION_EVENT, true],
  ] as const) {
    socket.on(event, async (payload: unknown, callback) => {
      const contextError = getGameSocketContext(socket);
      if (contextError) return sendGameResponse(callback, contextError);
      if (!exactObjectKeys(payload, ['roundId', 'description']))
        return sendGameResponse(callback, invalid('بيانات الوصف غير صالحة.'));
      const data = payload as { roundId?: unknown; description?: unknown };
      if (typeof data.roundId !== 'string')
        return sendGameResponse(callback, invalid('معرّف الجولة غير صالح.'));
      const roomId = socket.data.roomId!;
      try {
        settleEyewitnessDeadline(io, roomId);
        const match = getEyewitnessMatch(roomId);
        if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
        const result = submit
          ? submitEyewitnessDescription(match, socket.data.playerId!, {
              roundId: data.roundId,
              description: data.description,
            })
          : updateEyewitnessDescription(match, socket.data.playerId!, {
              roundId: data.roundId,
              description: data.description,
            });
        if (!result.ok) return sendGameResponse(callback, invalid(result.message));
        if (result.changed) setEyewitnessMatch(roomId, result.match);
        if (submit && result.changed) {
          broadcastChanged(io, roomId);
          restartEyewitnessTimer(io, roomId);
        }
        await respondView(io, roomId, socket.data.playerId!, callback);
      } catch {
        sendGameInternalError(callback);
      }
    });
  }

  socket.on(EYEWITNESS_STROKE_EVENT, (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!allowStrokeEvent(socket))
      return sendGameResponse(callback, invalid('تم إرسال الرسم بسرعة كبيرة.'));
    const isEnd =
      Boolean(payload) &&
      typeof payload === 'object' &&
      Array.isArray((payload as { points?: unknown }).points) &&
      (payload as { points: unknown[] }).points.length === 0;
    const keys = isEnd
      ? ['turnId', 'strokeId', 'points']
      : ['turnId', 'strokeId', 'tool', 'color', 'size', 'points'];
    if (!exactObjectKeys(payload, keys)) return sendGameResponse(callback, mapStrokeError());
    const context = drawingContext(socket);
    if ('error' in context && context.error) return sendGameResponse(callback, context.error);
    const result = processStrokeCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: context.match.round.roundId,
      strokes: context.artwork.strokes,
      payload,
      limits: DRAW_GUESS_BOARD_LIMITS,
    });
    if (!result.ok) return sendGameResponse(callback, mapStrokeError());
    if (result.kind === 'start') {
      setEyewitnessMatch(
        context.roomId,
        updateEyewitnessArtworkStrokes(context.match, context.playerId, result.strokes),
      );
    }
    sendGameResponse(callback, { success: true, data: { ok: true } });
  });

  socket.on(EYEWITNESS_STROKE_POINTS_EVENT, (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!allowStrokeEvent(socket))
      return sendGameResponse(callback, invalid('تم إرسال الرسم بسرعة كبيرة.'));
    if (!exactObjectKeys(payload, ['turnId', 'strokeId', 'points']))
      return sendGameResponse(callback, mapStrokeError());
    const context = drawingContext(socket);
    if ('error' in context && context.error) return sendGameResponse(callback, context.error);
    const result = processStrokePointsCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: context.match.round.roundId,
      strokes: context.artwork.strokes,
      payload,
      limits: DRAW_GUESS_BOARD_LIMITS,
    });
    if (!result.ok) return sendGameResponse(callback, mapStrokeError());
    setEyewitnessMatch(
      context.roomId,
      updateEyewitnessArtworkStrokes(context.match, context.playerId, result.strokes),
    );
    sendGameResponse(callback, { success: true, data: { ok: true } });
  });

  for (const event of [EYEWITNESS_CLEAR_CANVAS_EVENT, EYEWITNESS_UNDO_EVENT] as const) {
    socket.on(event, async (payload: unknown, callback) => {
      const contextError = getGameSocketContext(socket);
      if (contextError) return sendGameResponse(callback, contextError);
      if (!exactObjectKeys(payload, ['roundId']))
        return sendGameResponse(callback, invalid('طلب تعديل اللوحة غير صالح.'));
      const context = drawingContext(socket);
      if ('error' in context && context.error) return sendGameResponse(callback, context.error);
      if ((payload as { roundId?: unknown }).roundId !== context.match.round.roundId)
        return sendGameResponse(callback, invalid('هذا الطلب يخص جولة سابقة.'));
      const strokes =
        event === EYEWITNESS_CLEAR_CANVAS_EVENT ? [] : context.artwork.strokes.slice(0, -1);
      const next = updateEyewitnessArtworkStrokes(context.match, context.playerId, strokes);
      setEyewitnessMatch(context.roomId, next);
      await respondView(io, context.roomId, context.playerId, callback);
    });
  }

  socket.on(EYEWITNESS_SUBMIT_ARTWORK_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['roundId']))
      return sendGameResponse(callback, invalid('طلب تسليم الرسمة غير صالح.'));
    const roundId = (payload as { roundId?: unknown }).roundId;
    if (typeof roundId !== 'string')
      return sendGameResponse(callback, invalid('معرّف الجولة غير صالح.'));
    const roomId = socket.data.roomId!;
    try {
      settleEyewitnessDeadline(io, roomId);
      const match = getEyewitnessMatch(roomId);
      if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
      const result = submitEyewitnessArtwork(match, socket.data.playerId!, roundId);
      if (!result.ok) return sendGameResponse(callback, invalid(result.message));
      setEyewitnessMatch(roomId, result.match);
      broadcastChanged(io, roomId);
      restartEyewitnessTimer(io, roomId);
      await respondView(io, roomId, socket.data.playerId!, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(EYEWITNESS_CONFIRM_VOTE_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['roundId', 'artworkId']))
      return sendGameResponse(callback, invalid('بيانات التصويت غير صالحة.'));
    const data = payload as { roundId?: unknown; artworkId?: unknown };
    if (typeof data.roundId !== 'string' || typeof data.artworkId !== 'string')
      return sendGameResponse(callback, invalid('بيانات التصويت غير صالحة.'));
    const roomId = socket.data.roomId!;
    try {
      settleEyewitnessDeadline(io, roomId);
      const match = getEyewitnessMatch(roomId);
      if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
      const result = confirmEyewitnessVote(match, socket.data.playerId!, {
        roundId: data.roundId,
        artworkId: data.artworkId,
      });
      if (!result.ok) return sendGameResponse(callback, invalid(result.message));
      if (result.changed) setEyewitnessMatch(roomId, result.match);
      await respondView(io, roomId, socket.data.playerId!, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(EYEWITNESS_ADVANCE_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['roundId', 'requestId']))
      return sendGameResponse(callback, invalid('طلب الانتقال غير صالح.'));
    const data = payload as { roundId?: unknown; requestId?: unknown };
    if (typeof data.roundId !== 'string' || !validRequestId(data.requestId))
      return sendGameResponse(callback, invalid('طلب الانتقال غير صالح.'));
    const roomId = socket.data.roomId!;
    try {
      const host = await assertGameShellHost(roomId, socket.data.playerId!);
      if (!host.success) return sendGameResponse(callback, host);
      const match = getEyewitnessMatch(roomId);
      if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
      if (match.round.roundId !== data.roundId) {
        if (match.processedRequestIds.includes(data.requestId)) {
          await respondView(io, roomId, socket.data.playerId!, callback);
          return;
        }
        return sendGameResponse(callback, invalid('هذا الطلب يخص جولة سابقة.'));
      }
      advanceEyewitnessAtBoundary(io, roomId, data.requestId);
      await respondView(io, roomId, socket.data.playerId!, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });
}
