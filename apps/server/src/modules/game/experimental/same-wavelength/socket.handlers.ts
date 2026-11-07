import type { Prisma } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import type {
  GameActionResponse,
  SameWavelengthAssignPayload,
  SameWavelengthConfirmPayload,
  SameWavelengthLobbyView,
  SameWavelengthNextPayload,
  SameWavelengthPlayerView,
  SameWavelengthProposalPayload,
  SameWavelengthSubmitCluePayload,
} from '@wanasatna/shared';
import {
  SAME_WAVELENGTH_ASSIGN_EVENT,
  SAME_WAVELENGTH_CONFIRM_EVENT,
  SAME_WAVELENGTH_GAME_ID,
  SAME_WAVELENGTH_LOBBY_SYNC_EVENT,
  SAME_WAVELENGTH_NEXT_EVENT,
  SAME_WAVELENGTH_PHASE_CHANGED_EVENT,
  SAME_WAVELENGTH_PROPOSE_EVENT,
  SAME_WAVELENGTH_SUBMIT_CLUE_EVENT,
  SAME_WAVELENGTH_SYNC_EVENT,
  SAME_WAVELENGTH_UPDATE_SETTINGS_EVENT,
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
import { ensureSameWavelengthMatch } from './init-match.js';
import {
  assignSameWavelengthPlayer,
  buildSameWavelengthLobbyView,
  hydrateSameWavelengthLobbyState,
  persistSameWavelengthSettings,
  setSameWavelengthLobbySettings,
  validateSameWavelengthSettings,
} from './lobby-state.js';
import { restartSameWavelengthTimer, settleSameWavelengthDeadline } from './phase-timer.js';
import {
  advanceSameWavelengthTurn,
  buildSameWavelengthPlayerView,
  confirmSameWavelengthPosition,
  proposeSameWavelengthPosition,
  submitSameWavelengthClue,
  type SameWavelengthMatchState,
} from './state.js';
import { getSameWavelengthMatch, setSameWavelengthMatch } from './store.js';

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
  hydrateSameWavelengthLobbyState(roomId, room.gameSettings);
  const players = await loadActiveRoomPlayers(roomId, room.hostPlayerId);
  return { room, players };
}

async function canAdministerLobby(socket: Socket): Promise<boolean> {
  const roomId = socket.data.roomId as string;
  const playerId = socket.data.playerId as string;
  if (getGameShellByRoomId(roomId)) return false;
  const context = await loadLobbyContext(roomId);
  if (!context) return false;
  const account = await resolveSocketAccountUser(socket);
  const denied = await preflightExperimentalGameStart({
    roomId,
    playerId,
    gameId: SAME_WAVELENGTH_GAME_ID,
    authority: {
      accountUserId: account?.id ?? null,
      accountRole: account?.role ?? null,
    },
  });
  return denied === null;
}

async function buildLobbyView(socket: Socket): Promise<SameWavelengthLobbyView | null> {
  const roomId = socket.data.roomId as string;
  const context = await loadLobbyContext(roomId);
  if (!context || getExperimentalGameSelection(roomId)?.gameId !== SAME_WAVELENGTH_GAME_ID) {
    return null;
  }
  return buildSameWavelengthLobbyView({
    roomId,
    players: context.players.map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      isConnected: player.status === 'CONNECTED',
      isReady: false,
      isSpectator: player.isSpectator,
    })),
    selfPlayerId: socket.data.playerId as string,
    canAdminister: await canAdministerLobby(socket),
  });
}

async function respondLobbyView(
  socket: Socket,
  callback: ((response: GameActionResponse<{ view: SameWavelengthLobbyView }>) => void) | undefined,
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
    ((response: GameActionResponse<{ view: SameWavelengthPlayerView }>) => void) | undefined,
  roomId: string,
  playerId: string,
): void {
  const shell = getGameShellByRoomId(roomId);
  const match = getSameWavelengthMatch(roomId);
  if (!shell || !match) {
    sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    return;
  }
  sendGameResponse(callback, {
    success: true,
    data: { view: buildSameWavelengthPlayerView(match, playerId, shell) },
  });
}

function broadcastChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(SAME_WAVELENGTH_PHASE_CHANGED_EVENT, {});
}

function commitAction(
  io: Server,
  roomId: string,
  result:
    | { ok: true; match: SameWavelengthMatchState; changed: boolean }
    | { ok: false; message: string },
): Extract<GameActionResponse<never>, { success: false }> | null {
  if (!result.ok) return invalid(result.message);
  if (result.changed) {
    setSameWavelengthMatch(roomId, result.match);
    broadcastChanged(io, roomId);
    restartSameWavelengthTimer(io, roomId);
  }
  return null;
}

async function updatePersistedSettings(
  socket: Socket,
  settings: Parameters<typeof persistSameWavelengthSettings>[1],
): Promise<Extract<GameActionResponse<never>, { success: false }> | null> {
  const roomId = socket.data.roomId!;
  const playerId = socket.data.playerId!;
  const account = await resolveSocketAccountUser(socket);
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (!(await lockRoomRow(tx, roomId))) return invalid('الغرفة غير موجودة.');
    const denied = await authorizeExperimentalGameStartLocked(tx, {
      roomId,
      playerId,
      gameId: SAME_WAVELENGTH_GAME_ID,
      authority: {
        accountUserId: account?.id ?? null,
        accountRole: account?.role ?? null,
      },
    });
    if (denied) return denied;
    if (getGameShellByRoomId(roomId)) return invalid('لا يمكن تعديل الوضع بعد بدء المباراة.');
    const room = await tx.room.findUnique({
      where: { id: roomId },
      select: { gameSettings: true },
    });
    if (!room) return invalid('الغرفة غير موجودة.');
    await tx.room.update({
      where: { id: roomId },
      data: { gameSettings: persistSameWavelengthSettings(room.gameSettings, settings) },
    });
    return null;
  });
  if (!result) setSameWavelengthLobbySettings(roomId, settings);
  return result;
}

export function registerSameWavelengthSocketHandlers(io: Server, socket: Socket): void {
  socket.on(SAME_WAVELENGTH_LOBBY_SYNC_EVENT, async (_payload, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (rejectIfGameSyncRateLimited(socket, callback)) return;
    try {
      await respondLobbyView(socket, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(SAME_WAVELENGTH_UPDATE_SETTINGS_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    const parsed = validateSameWavelengthSettings(payload);
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

  socket.on(SAME_WAVELENGTH_ASSIGN_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['team', 'role'])) {
      return sendGameResponse(callback, invalid('اختيار الفريق والدور غير صالح.'));
    }
    try {
      const roomId = socket.data.roomId!;
      const context = await loadLobbyContext(roomId);
      if (
        !context ||
        getExperimentalGameSelection(roomId)?.gameId !== SAME_WAVELENGTH_GAME_ID ||
        getGameShellByRoomId(roomId)
      ) {
        return sendGameResponse(callback, forbidden('لا يمكن تغيير الفريق أو الدور الآن.'));
      }
      const result = assignSameWavelengthPlayer(
        roomId,
        socket.data.playerId!,
        payload as SameWavelengthAssignPayload,
      );
      if (!result.success) return sendGameResponse(callback, invalid(result.error));
      broadcastChanged(io, roomId);
      await respondLobbyView(socket, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(SAME_WAVELENGTH_SYNC_EVENT, (_payload, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (rejectIfGameSyncRateLimited(socket, callback)) return;
    ensureSameWavelengthMatch(io, socket.data.roomId!);
    respondMatchView(callback, socket.data.roomId!, socket.data.playerId!);
  });

  socket.on(SAME_WAVELENGTH_SUBMIT_CLUE_EVENT, (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['turnId', 'clue', 'requestId'])) {
      return sendGameResponse(callback, invalid('بيانات التلميح غير صالحة.'));
    }
    const roomId = socket.data.roomId!;
    const now = Date.now();
    settleSameWavelengthDeadline(io, roomId, now);
    const match = getSameWavelengthMatch(roomId) ?? ensureSameWavelengthMatch(io, roomId);
    if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    const error = commitAction(
      io,
      roomId,
      submitSameWavelengthClue(
        match,
        socket.data.playerId!,
        payload as SameWavelengthSubmitCluePayload,
        now,
      ),
    );
    if (error) return sendGameResponse(callback, error);
    respondMatchView(callback, roomId, socket.data.playerId!);
  });

  socket.on(SAME_WAVELENGTH_PROPOSE_EVENT, (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['turnId', 'position', 'requestId'])) {
      return sendGameResponse(callback, invalid('بيانات العلامة غير صالحة.'));
    }
    const roomId = socket.data.roomId!;
    const now = Date.now();
    settleSameWavelengthDeadline(io, roomId, now);
    const match = getSameWavelengthMatch(roomId) ?? ensureSameWavelengthMatch(io, roomId);
    if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    const error = commitAction(
      io,
      roomId,
      proposeSameWavelengthPosition(
        match,
        socket.data.playerId!,
        payload as SameWavelengthProposalPayload,
        now,
      ),
    );
    if (error) return sendGameResponse(callback, error);
    respondMatchView(callback, roomId, socket.data.playerId!);
  });

  socket.on(SAME_WAVELENGTH_CONFIRM_EVENT, (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['turnId', 'requestId'])) {
      return sendGameResponse(callback, invalid('طلب التأكيد غير صالح.'));
    }
    const roomId = socket.data.roomId!;
    const now = Date.now();
    settleSameWavelengthDeadline(io, roomId, now);
    const match = getSameWavelengthMatch(roomId) ?? ensureSameWavelengthMatch(io, roomId);
    if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    const error = commitAction(
      io,
      roomId,
      confirmSameWavelengthPosition(
        match,
        socket.data.playerId!,
        payload as SameWavelengthConfirmPayload,
        now,
      ),
    );
    if (error) return sendGameResponse(callback, error);
    respondMatchView(callback, roomId, socket.data.playerId!);
  });

  socket.on(SAME_WAVELENGTH_NEXT_EVENT, (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['turnId', 'requestId'])) {
      return sendGameResponse(callback, invalid('طلب المتابعة غير صالح.'));
    }
    const roomId = socket.data.roomId!;
    const shell = getGameShellByRoomId(roomId);
    if (shell?.hostPlayerId !== socket.data.playerId) {
      return sendGameResponse(callback, forbidden('المضيف الحالي فقط يمكنه المتابعة.'));
    }
    const request = payload as SameWavelengthNextPayload;
    const match = getSameWavelengthMatch(roomId);
    if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    if (match.processedRequestIds.includes(request.requestId)) {
      return sendGameResponse(callback, invalid('تم تنفيذ هذا الطلب مسبقًا.'));
    }
    const accepted = {
      ...match,
      processedRequestIds: [...match.processedRequestIds, request.requestId].slice(-200),
    };
    const next = advanceSameWavelengthTurn(accepted, request.turnId);
    if (!next) return sendGameResponse(callback, invalid('لا يمكن الانتقال الآن.'));
    setSameWavelengthMatch(roomId, next);
    broadcastChanged(io, roomId);
    restartSameWavelengthTimer(io, roomId);
    respondMatchView(callback, roomId, socket.data.playerId!);
  });
}
