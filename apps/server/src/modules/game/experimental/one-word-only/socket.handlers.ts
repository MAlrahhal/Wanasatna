import type { Prisma } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import type {
  GameActionResponse,
  OneWordOnlyLobbyView,
  OneWordOnlyPlayerView,
} from '@wanasatna/shared';
import {
  ONE_WORD_ONLY_ADVANCE_EVENT,
  ONE_WORD_ONLY_CONFIRM_ANSWER_EVENT,
  ONE_WORD_ONLY_GAME_ID,
  ONE_WORD_ONLY_LOBBY_SYNC_EVENT,
  ONE_WORD_ONLY_MIN_PLAYERS,
  ONE_WORD_ONLY_PHASE_CHANGED_EVENT,
  ONE_WORD_ONLY_SUBMIT_CLUE_EVENT,
  ONE_WORD_ONLY_SYNC_EVENT,
  ONE_WORD_ONLY_UPDATE_SETTINGS_EVENT,
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
  authorizeExperimentalGameStartLocked,
  preflightExperimentalGameStart,
} from '../experimental-game-access.service.js';
import {
  getExperimentalGameSelection,
  hydrateExperimentalGameSelection,
} from '../experimental-game-selection.store.js';
import { ensureOneWordOnlyMatch } from './init-match.js';
import {
  getOneWordOnlyLobbySettings,
  hydrateOneWordOnlyLobbySettings,
  persistOneWordOnlySettings,
  setOneWordOnlyLobbySettings,
  validateOneWordOnlySettings,
} from './lobby-settings.js';
import {
  advanceOneWordOnlyAtBoundary,
  reconcileOneWordOnlyConnectivity,
  restartOneWordOnlyTimer,
  settleOneWordOnlyDeadline,
} from './phase-timer.js';
import {
  buildOneWordOnlyPlayerView,
  confirmOneWordOnlyAnswer,
  submitOneWordOnlyClue,
} from './state.js';
import { getOneWordOnlyMatch, setOneWordOnlyMatch } from './store.js';

type ViewResponse = GameActionResponse<{ view: OneWordOnlyPlayerView }>;

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

function broadcastChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(ONE_WORD_ONLY_PHASE_CHANGED_EVENT, {});
}

async function loadLobbyContext(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostPlayerId: true, gameSettings: true },
  });
  if (!room) return null;
  hydrateExperimentalGameSelection(roomId, room.gameSettings);
  hydrateOneWordOnlyLobbySettings(roomId, room.gameSettings);
  const players = await loadActiveRoomPlayers(roomId, room.hostPlayerId);
  return { room, players };
}

async function buildLobbyView(socket: Socket): Promise<OneWordOnlyLobbyView | null> {
  const roomId = socket.data.roomId as string;
  const playerId = socket.data.playerId as string;
  const context = await loadLobbyContext(roomId);
  if (!context || getExperimentalGameSelection(roomId)?.gameId !== ONE_WORD_ONLY_GAME_ID)
    return null;
  const account = await resolveSocketAccountUser(socket);
  const denied = await preflightExperimentalGameStart({
    roomId,
    playerId,
    gameId: ONE_WORD_ONLY_GAME_ID,
    authority: { accountUserId: account?.id ?? null, accountRole: account?.role ?? null },
  });
  return {
    gameId: ONE_WORD_ONLY_GAME_ID,
    settings: getOneWordOnlyLobbySettings(roomId),
    canEditSettings: denied === null && getGameShellByRoomId(roomId) === null,
    participantCount: context.players.filter(
      (player) => player.status === 'CONNECTED' && !player.isSpectator,
    ).length,
    minPlayers: ONE_WORD_ONLY_MIN_PLAYERS,
  };
}

async function respondLobbyView(
  socket: Socket,
  callback: ((response: GameActionResponse<{ view: OneWordOnlyLobbyView }>) => void) | undefined,
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
): Promise<OneWordOnlyPlayerView | null> {
  settleOneWordOnlyDeadline(io, roomId);
  await syncGameShell(roomId);
  const shell = getGameShellByRoomId(roomId);
  let match = getOneWordOnlyMatch(roomId) ?? ensureOneWordOnlyMatch(io, roomId);
  if (!shell || shell.gameId !== ONE_WORD_ONLY_GAME_ID || !match) return null;
  // Reconnect acknowledgements intentionally precede their post-ack side effects.
  // A direct sync must therefore reconcile the freshly loaded shell itself.
  reconcileOneWordOnlyConnectivity(io, roomId);
  match = getOneWordOnlyMatch(roomId) ?? match;
  return buildOneWordOnlyPlayerView(match, playerId, shell);
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
  settings: ReturnType<typeof getOneWordOnlyLobbySettings>,
): Promise<Extract<GameActionResponse<never>, { success: false }> | null> {
  const roomId = socket.data.roomId!;
  const playerId = socket.data.playerId!;
  const account = await resolveSocketAccountUser(socket);
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (!(await lockRoomRow(tx, roomId))) return invalid('الغرفة غير موجودة.');
    const denied = await authorizeExperimentalGameStartLocked(tx, {
      roomId,
      playerId,
      gameId: ONE_WORD_ONLY_GAME_ID,
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
      data: { gameSettings: persistOneWordOnlySettings(room.gameSettings, settings) },
    });
    return null;
  });
  if (!result) setOneWordOnlyLobbySettings(roomId, settings);
  return result;
}

function validRequestId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 100;
}

export function registerOneWordOnlySocketHandlers(io: Server, socket: Socket): void {
  socket.on(ONE_WORD_ONLY_LOBBY_SYNC_EVENT, async (payload: unknown, callback) => {
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

  socket.on(ONE_WORD_ONLY_UPDATE_SETTINGS_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    const parsed = validateOneWordOnlySettings(payload);
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

  socket.on(ONE_WORD_ONLY_SYNC_EVENT, async (payload: unknown, callback) => {
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

  socket.on(ONE_WORD_ONLY_SUBMIT_CLUE_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['roundId', 'clue'])) {
      return sendGameResponse(callback, invalid('بيانات التلميح غير صالحة.'));
    }
    const action = payload as { roundId?: unknown; clue?: unknown };
    if (typeof action.roundId !== 'string')
      return sendGameResponse(callback, invalid('معرّف الجولة غير صالح.'));
    const roomId = socket.data.roomId!;
    try {
      settleOneWordOnlyDeadline(io, roomId);
      const match = getOneWordOnlyMatch(roomId) ?? ensureOneWordOnlyMatch(io, roomId);
      const shell = getGameShellByRoomId(roomId);
      if (!match || !shell) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
      const guesserConnected = shell.players.some(
        (player) => player.id === match.round.guesserPlayerId && player.isConnected,
      );
      const result = submitOneWordOnlyClue(
        match,
        socket.data.playerId!,
        { roundId: action.roundId, clue: action.clue },
        guesserConnected,
      );
      if (!result.ok) return sendGameResponse(callback, invalid(result.message));
      if (result.changed) {
        setOneWordOnlyMatch(roomId, result.match);
        broadcastChanged(io, roomId);
        restartOneWordOnlyTimer(io, roomId);
      }
      await respondView(io, roomId, socket.data.playerId!, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(ONE_WORD_ONLY_CONFIRM_ANSWER_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['roundId', 'optionId', 'requestId'])) {
      return sendGameResponse(callback, invalid('بيانات الإجابة غير صالحة.'));
    }
    const action = payload as Record<string, unknown>;
    if (
      typeof action.roundId !== 'string' ||
      typeof action.optionId !== 'string' ||
      !validRequestId(action.requestId)
    )
      return sendGameResponse(callback, invalid('بيانات الإجابة غير صالحة.'));
    const roomId = socket.data.roomId!;
    try {
      settleOneWordOnlyDeadline(io, roomId);
      const match = getOneWordOnlyMatch(roomId);
      if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
      const result = confirmOneWordOnlyAnswer(match, socket.data.playerId!, {
        roundId: action.roundId,
        optionId: action.optionId,
        requestId: action.requestId,
      });
      if (!result.ok) return sendGameResponse(callback, invalid(result.message));
      if (result.changed) {
        setOneWordOnlyMatch(roomId, result.match);
        broadcastChanged(io, roomId);
        restartOneWordOnlyTimer(io, roomId);
      }
      await respondView(io, roomId, socket.data.playerId!, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(ONE_WORD_ONLY_ADVANCE_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['roundId', 'requestId'])) {
      return sendGameResponse(callback, invalid('طلب الانتقال غير صالح.'));
    }
    const action = payload as Record<string, unknown>;
    if (typeof action.roundId !== 'string' || !validRequestId(action.requestId)) {
      return sendGameResponse(callback, invalid('طلب الانتقال غير صالح.'));
    }
    const roomId = socket.data.roomId!;
    try {
      const host = await assertGameShellHost(roomId, socket.data.playerId!);
      if (!host.success) return sendGameResponse(callback, host);
      const match = getOneWordOnlyMatch(roomId);
      if (!match) {
        return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
      }
      if (match.round.roundId !== action.roundId) {
        if (match.processedRequestIds.includes(action.requestId)) {
          await respondView(io, roomId, socket.data.playerId!, callback);
          return;
        }
        return sendGameResponse(callback, invalid('هذا الطلب يخص جولة سابقة.'));
      }
      advanceOneWordOnlyAtBoundary(io, roomId, action.requestId);
      await respondView(io, roomId, socket.data.playerId!, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });
}
