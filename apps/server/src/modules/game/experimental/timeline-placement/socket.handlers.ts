import type { Prisma } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import type {
  GameActionResponse,
  TimelinePlacementChoosePayload,
  TimelinePlacementContinuePayload,
  TimelinePlacementLobbyView,
  TimelinePlacementPlayerView,
} from '@wanasatna/shared';
import {
  TIMELINE_PLACEMENT_CHOOSE_EVENT,
  TIMELINE_PLACEMENT_CONTINUE_EVENT,
  TIMELINE_PLACEMENT_GAME_ID,
  TIMELINE_PLACEMENT_LOBBY_SYNC_EVENT,
  TIMELINE_PLACEMENT_MAX_PLAYERS,
  TIMELINE_PLACEMENT_MIN_PLAYERS,
  TIMELINE_PLACEMENT_PHASE_CHANGED_EVENT,
  TIMELINE_PLACEMENT_SYNC_EVENT,
  TIMELINE_PLACEMENT_UPDATE_SETTINGS_EVENT,
} from '@wanasatna/shared';
import { prisma } from '../../../../lib/prisma.js';
import { resolveSocketAccountUser } from '../../../auth/socket-auth.js';
import { getRoomChannel, loadActiveRoomPlayers } from '../../../room/room.utils.js';
import { lockRoomRow } from '../../../room/services/room-tx.js';
import { getGameShellByRoomId } from '../../game.service.js';
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
import { ensureTimelinePlacementMatch } from './init-match.js';
import {
  getTimelinePlacementLobbySettings,
  hydrateTimelinePlacementLobbySettings,
  persistTimelinePlacementSettings,
  setTimelinePlacementLobbySettings,
  validateTimelinePlacementSettings,
} from './lobby-settings.js';
import { restartTimelinePlacementTimer, settleTimelinePlacementDeadline } from './phase-timer.js';
import {
  advanceTimelinePlacementAnswer,
  buildTimelinePlacementPlayerView,
  chooseTimelineGap,
} from './state.js';
import { getTimelinePlacementMatch, setTimelinePlacementMatch } from './store.js';

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

async function loadLobbyContext(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostPlayerId: true, gameSettings: true },
  });
  if (!room) return null;
  hydrateExperimentalGameSelection(roomId, room.gameSettings);
  hydrateTimelinePlacementLobbySettings(roomId, room.gameSettings);
  const players = await loadActiveRoomPlayers(roomId, room.hostPlayerId);
  return { room, players };
}

async function buildLobbyView(socket: Socket): Promise<TimelinePlacementLobbyView | null> {
  const roomId = socket.data.roomId as string;
  const playerId = socket.data.playerId as string;
  const context = await loadLobbyContext(roomId);
  if (!context || getExperimentalGameSelection(roomId)?.gameId !== TIMELINE_PLACEMENT_GAME_ID) {
    return null;
  }
  const account = await resolveSocketAccountUser(socket);
  const denied = await preflightExperimentalGameStart({
    roomId,
    playerId,
    gameId: TIMELINE_PLACEMENT_GAME_ID,
    authority: {
      accountUserId: account?.id ?? null,
      accountRole: account?.role ?? null,
    },
  });
  return {
    gameId: TIMELINE_PLACEMENT_GAME_ID,
    settings: getTimelinePlacementLobbySettings(roomId),
    canEditSettings: denied === null && getGameShellByRoomId(roomId) === null,
    participantCount: context.players.filter(
      (player) => player.status === 'CONNECTED' && !player.isSpectator,
    ).length,
    minPlayers: TIMELINE_PLACEMENT_MIN_PLAYERS,
    maxPlayers: TIMELINE_PLACEMENT_MAX_PLAYERS,
  };
}

async function respondLobbyView(
  socket: Socket,
  callback:
    ((response: GameActionResponse<{ view: TimelinePlacementLobbyView }>) => void) | undefined,
): Promise<void> {
  const view = await buildLobbyView(socket);
  if (!view) {
    sendGameResponse(callback, forbidden('هذه الغرفة ليست جلسة اختبار معتمدة للعبة.'));
    return;
  }
  sendGameResponse(callback, { success: true, data: { view } });
}

function respondMatchView(
  callback:
    ((response: GameActionResponse<{ view: TimelinePlacementPlayerView }>) => void) | undefined,
  roomId: string,
  playerId: string,
): void {
  const shell = getGameShellByRoomId(roomId);
  const match = getTimelinePlacementMatch(roomId);
  if (!shell || !match) {
    sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    return;
  }
  sendGameResponse(callback, {
    success: true,
    data: { view: buildTimelinePlacementPlayerView(match, playerId, shell) },
  });
}

function broadcastChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(TIMELINE_PLACEMENT_PHASE_CHANGED_EVENT, {});
}

async function updatePersistedSettings(
  socket: Socket,
  settings: ReturnType<typeof getTimelinePlacementLobbySettings>,
): Promise<Extract<GameActionResponse<never>, { success: false }> | null> {
  const roomId = socket.data.roomId!;
  const playerId = socket.data.playerId!;
  const account = await resolveSocketAccountUser(socket);
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (!(await lockRoomRow(tx, roomId))) return invalid('الغرفة غير موجودة.');
    const denied = await authorizeExperimentalGameStartLocked(tx, {
      roomId,
      playerId,
      gameId: TIMELINE_PLACEMENT_GAME_ID,
      authority: {
        accountUserId: account?.id ?? null,
        accountRole: account?.role ?? null,
      },
    });
    if (denied) return denied;
    if (getGameShellByRoomId(roomId)) {
      return invalid('لا يمكن تعديل الإعدادات بعد بدء المباراة.');
    }
    const room = await tx.room.findUnique({
      where: { id: roomId },
      select: { gameSettings: true },
    });
    if (!room) return invalid('الغرفة غير موجودة.');
    await tx.room.update({
      where: { id: roomId },
      data: { gameSettings: persistTimelinePlacementSettings(room.gameSettings, settings) },
    });
    return null;
  });
  if (!result) setTimelinePlacementLobbySettings(roomId, settings);
  return result;
}

export function registerTimelinePlacementSocketHandlers(io: Server, socket: Socket): void {
  socket.on(TIMELINE_PLACEMENT_LOBBY_SYNC_EVENT, async (_payload, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (rejectIfGameSyncRateLimited(socket, callback)) return;
    try {
      await respondLobbyView(socket, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(TIMELINE_PLACEMENT_UPDATE_SETTINGS_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    const parsed = validateTimelinePlacementSettings(payload);
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

  socket.on(TIMELINE_PLACEMENT_SYNC_EVENT, (_payload, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (rejectIfGameSyncRateLimited(socket, callback)) return;
    ensureTimelinePlacementMatch(io, socket.data.roomId!);
    respondMatchView(callback, socket.data.roomId!, socket.data.playerId!);
  });

  socket.on(TIMELINE_PLACEMENT_CHOOSE_EVENT, (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['roundId', 'gapId'])) {
      return sendGameResponse(callback, invalid('بيانات الاختيار غير صالحة.'));
    }
    const choice = payload as TimelinePlacementChoosePayload;
    if (
      typeof choice.roundId !== 'string' ||
      !choice.roundId ||
      typeof choice.gapId !== 'string' ||
      !choice.gapId
    ) {
      return sendGameResponse(callback, invalid('بيانات الاختيار غير صالحة.'));
    }
    const roomId = socket.data.roomId!;
    const now = Date.now();
    settleTimelinePlacementDeadline(io, roomId, now);
    const match = getTimelinePlacementMatch(roomId) ?? ensureTimelinePlacementMatch(io, roomId);
    if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    const result = chooseTimelineGap(match, socket.data.playerId!, choice, now);
    if (!result.ok) return sendGameResponse(callback, invalid(result.message));
    if (result.changed) {
      setTimelinePlacementMatch(roomId, result.match);
      broadcastChanged(io, roomId);
    }
    respondMatchView(callback, roomId, socket.data.playerId!);
  });

  socket.on(TIMELINE_PLACEMENT_CONTINUE_EVENT, (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['roundId'])) {
      return sendGameResponse(callback, invalid('طلب الانتقال غير صالح.'));
    }
    const request = payload as TimelinePlacementContinuePayload;
    if (typeof request.roundId !== 'string' || !request.roundId) {
      return sendGameResponse(callback, invalid('طلب الانتقال غير صالح.'));
    }
    const roomId = socket.data.roomId!;
    const now = Date.now();
    settleTimelinePlacementDeadline(io, roomId, now);
    const shell = getGameShellByRoomId(roomId);
    const match = getTimelinePlacementMatch(roomId) ?? ensureTimelinePlacementMatch(io, roomId);
    if (!shell || !match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    const result = advanceTimelinePlacementAnswer(
      match,
      socket.data.playerId!,
      shell.hostPlayerId,
      request,
      now,
    );
    if (!result.ok) return sendGameResponse(callback, invalid(result.message));
    if (result.changed) {
      setTimelinePlacementMatch(roomId, result.match);
      broadcastChanged(io, roomId);
      restartTimelinePlacementTimer(io, roomId);
    }
    respondMatchView(callback, roomId, socket.data.playerId!);
  });
}
