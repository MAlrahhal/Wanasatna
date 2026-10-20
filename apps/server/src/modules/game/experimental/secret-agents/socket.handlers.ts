import type { Server, Socket } from 'socket.io';
import type {
  GameActionResponse,
  SecretAgentsAssignPayload,
  SecretAgentsCardActionPayload,
  SecretAgentsPassPayload,
  SecretAgentsSubmitCluePayload,
} from '@wanasatna/shared';
import {
  SECRET_AGENTS_ASSIGN_EVENT,
  SECRET_AGENTS_CONFIRM_CARD_EVENT,
  SECRET_AGENTS_GAME_ID,
  SECRET_AGENTS_LOBBY_SYNC_EVENT,
  SECRET_AGENTS_MAX_PLAYERS,
  SECRET_AGENTS_PASS_EVENT,
  SECRET_AGENTS_PHASE_CHANGED_EVENT,
  SECRET_AGENTS_RANDOMIZE_EVENT,
  SECRET_AGENTS_SUBMIT_CLUE_EVENT,
  SECRET_AGENTS_SYNC_EVENT,
  SECRET_AGENTS_TOGGLE_NOMINATION_EVENT,
  SECRET_AGENTS_UPDATE_SETTINGS_EVENT,
} from '@wanasatna/shared';
import { prisma } from '../../../../lib/prisma.js';
import { resolveSocketAccountUser } from '../../../auth/socket-auth.js';
import { loadActiveRoomPlayers, getRoomChannel } from '../../../room/room.utils.js';
import {
  getGameShellByRoomId,
  promotePlayerIntoActiveMatch,
  syncGameShell,
} from '../../game.service.js';
import { broadcastGameShellState } from '../../game.timer.js';
import {
  getGameSocketContext,
  rejectIfGameSyncRateLimited,
  sendGameInternalError,
  sendGameResponse,
} from '../../game.socket.utils.js';
import {
  getExperimentalGameSelection,
  hydrateExperimentalGameSelection,
} from '../experimental-game-selection.store.js';
import { queuePromotionPersistence } from '../../runtime/absorb-spectators-for-next-round.js';
import { ensureSecretAgentsMatch } from './init-match.js';
import {
  assignSecretAgentsLobbyPlayer,
  buildSecretAgentsLobbyView,
  randomizeSecretAgentsLobbyAssignments,
  updateSecretAgentsLobbySettings,
} from './lobby-state.js';
import {
  reconcileSecretAgentsConnectivity,
  restartSecretAgentsTimer,
  settleSecretAgentsDeadline,
} from './phase-timer.js';
import {
  addSecretAgentsMidMatchPlayer,
  buildSecretAgentsPlayerView,
  confirmSecretAgentsCard,
  passSecretAgentsTurn,
  submitSecretAgentsClue,
  toggleSecretAgentsNomination,
} from './state.js';
import { getSecretAgentsMatch, setSecretAgentsMatch } from './store.js';

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
    Object.keys(payload as object).every((key) => allowed.includes(key)) &&
    Object.keys(payload as object).length === allowed.length
  );
}

async function canAdministerLobby(socket: Socket): Promise<boolean> {
  const roomId = socket.data.roomId as string | undefined;
  const playerId = socket.data.playerId as string | undefined;
  if (!roomId || !playerId || getGameShellByRoomId(roomId)) return false;
  const persistedRoom = await prisma.room.findUnique({
    where: { id: roomId },
    select: { gameSettings: true },
  });
  if (!persistedRoom) return false;
  hydrateExperimentalGameSelection(roomId, persistedRoom.gameSettings);
  const selection = getExperimentalGameSelection(roomId);
  const account = await resolveSocketAccountUser(socket);
  return Boolean(
    selection &&
    selection.gameId === SECRET_AGENTS_GAME_ID &&
    selection.hostPlayerId === playerId &&
    selection.adminUserId === account?.id &&
    account?.role === 'ADMIN',
  );
}

async function loadLobbyPlayers(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostPlayerId: true, gameSettings: true },
  });
  if (!room) return null;
  hydrateExperimentalGameSelection(roomId, room.gameSettings);
  const players = await loadActiveRoomPlayers(roomId, room.hostPlayerId);
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    isHost: player.isHost,
    isConnected: player.status === 'CONNECTED',
    isReady: false,
    isSpectator: player.isSpectator,
  }));
}

async function respondLobbyView(
  socket: Socket,
  callback: ((response: GameActionResponse<{ view: unknown }>) => void) | undefined,
): Promise<void> {
  const roomId = socket.data.roomId as string;
  const players = await loadLobbyPlayers(roomId);
  if (!players || getExperimentalGameSelection(roomId)?.gameId !== SECRET_AGENTS_GAME_ID) {
    sendGameResponse(callback, forbidden('هذه الغرفة ليست جلسة اختبار معتمدة لهذه اللعبة.'));
    return;
  }
  sendGameResponse(callback, {
    success: true,
    data: {
      view: buildSecretAgentsLobbyView({
        roomId,
        players,
        selfPlayerId: socket.data.playerId as string,
        canAdminister: await canAdministerLobby(socket),
      }),
    },
  });
}

function respondMatchView(
  callback: ((response: GameActionResponse<{ view: unknown }>) => void) | undefined,
  roomId: string,
  playerId: string,
): void {
  const shell = getGameShellByRoomId(roomId);
  const match = getSecretAgentsMatch(roomId);
  if (!shell || !match) {
    sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    return;
  }
  sendGameResponse(callback, {
    success: true,
    data: { view: buildSecretAgentsPlayerView(match, playerId, shell) },
  });
}

function broadcastChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(SECRET_AGENTS_PHASE_CHANGED_EVENT, {});
}

function commitAction(
  io: Server,
  roomId: string,
  result:
    | { ok: true; match: NonNullable<ReturnType<typeof getSecretAgentsMatch>>; changed: boolean }
    | { ok: false; message: string },
): Extract<GameActionResponse<never>, { success: false }> | null {
  if (!result.ok) return invalid(result.message);
  if (result.changed) {
    setSecretAgentsMatch(roomId, result.match);
    broadcastChanged(io, roomId);
    reconcileSecretAgentsConnectivity(io, roomId);
    restartSecretAgentsTimer(io, roomId);
  }
  return null;
}

export function registerSecretAgentsSocketHandlers(io: Server, socket: Socket): void {
  let nominationWindowStartedAt = 0;
  let nominationCount = 0;

  socket.on(SECRET_AGENTS_LOBBY_SYNC_EVENT, async (_payload, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (rejectIfGameSyncRateLimited(socket, callback)) return;
    try {
      await respondLobbyView(socket, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(SECRET_AGENTS_ASSIGN_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    const roomId = socket.data.roomId!;
    const playerId = socket.data.playerId!;
    if (!exactObjectKeys(payload, ['team', 'role'])) {
      return sendGameResponse(callback, invalid('اختيار الفريق والدور غير صالح.'));
    }
    const assignment = payload as SecretAgentsAssignPayload;

    try {
      const shell = getGameShellByRoomId(roomId);
      if (!shell) {
        const persistedRoom = await prisma.room.findUnique({
          where: { id: roomId },
          select: { gameSettings: true },
        });
        if (persistedRoom) {
          hydrateExperimentalGameSelection(roomId, persistedRoom.gameSettings);
        }
        if (getExperimentalGameSelection(roomId)?.gameId !== SECRET_AGENTS_GAME_ID) {
          return sendGameResponse(callback, forbidden('هذه الغرفة ليست جلسة اختبار معتمدة.'));
        }
        const result = assignSecretAgentsLobbyPlayer(roomId, playerId, assignment);
        if (!result.success) return sendGameResponse(callback, invalid(result.error));
        broadcastChanged(io, roomId);
        await respondLobbyView(socket, callback);
        return;
      }

      if (shell.gameId !== SECRET_AGENTS_GAME_ID || shell.phase !== 'PLAYING') {
        return sendGameResponse(callback, invalid('لا يمكن اختيار الدور الآن.'));
      }
      if (
        (assignment.team !== 'red' && assignment.team !== 'blue') ||
        (assignment.role !== 'spymaster' && assignment.role !== 'operative')
      ) {
        return sendGameResponse(callback, invalid('اختيار الفريق والدور غير صالح.'));
      }
      await syncGameShell(roomId);
      const before = getSecretAgentsMatch(roomId) ?? ensureSecretAgentsMatch(io, roomId);
      const currentShell = getGameShellByRoomId(roomId);
      const player = currentShell?.players.find((candidate) => candidate.id === playerId);
      if (!before || !player?.isConnected) {
        return sendGameResponse(callback, invalid('تعذر إضافة اللاعب إلى المباراة.'));
      }
      if (before.assignments[playerId]) {
        return sendGameResponse(callback, invalid('تم تثبيت فريقك ودورك لهذه المباراة.'));
      }
      if (before.playerIds.length >= SECRET_AGENTS_MAX_PLAYERS) {
        return sendGameResponse(callback, invalid('اكتمل الحد الأقصى لمشاركي المباراة.'));
      }

      const latest = getSecretAgentsMatch(roomId);
      if (!latest) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
      const result = addSecretAgentsMidMatchPlayer(latest, {
        playerId,
        playerName: player.name,
        team: assignment.team,
        role: assignment.role,
      });
      if (!result.ok) return sendGameResponse(callback, invalid(result.message));
      const promoted = promotePlayerIntoActiveMatch(roomId, playerId, SECRET_AGENTS_MAX_PLAYERS);
      if (!promoted) return sendGameResponse(callback, invalid('تعذر حجز مقعد في المباراة.'));
      setSecretAgentsMatch(roomId, result.match);
      await queuePromotionPersistence(io, roomId, [playerId]);
      broadcastGameShellState(io, promoted);
      broadcastChanged(io, roomId);
      reconcileSecretAgentsConnectivity(io, roomId);
      respondMatchView(callback, roomId, playerId);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(SECRET_AGENTS_RANDOMIZE_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (payload && (typeof payload !== 'object' || Object.keys(payload as object).length > 0)) {
      return sendGameResponse(callback, invalid('طلب التوزيع غير صالح.'));
    }
    try {
      if (!(await canAdministerLobby(socket))) {
        return sendGameResponse(callback, forbidden('التوزيع العشوائي متاح لمضيف الاختبار فقط.'));
      }
      const players = await loadLobbyPlayers(socket.data.roomId!);
      if (!players) return sendGameResponse(callback, invalid('الغرفة غير موجودة.'));
      randomizeSecretAgentsLobbyAssignments(
        socket.data.roomId!,
        players.filter((player) => player.isConnected).map((player) => player.id),
      );
      broadcastChanged(io, socket.data.roomId!);
      await respondLobbyView(socket, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(SECRET_AGENTS_UPDATE_SETTINGS_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    try {
      if (!(await canAdministerLobby(socket))) {
        return sendGameResponse(callback, forbidden('الإعدادات متاحة لمضيف الاختبار فقط.'));
      }
      const result = updateSecretAgentsLobbySettings(socket.data.roomId!, payload);
      if (!result.success) return sendGameResponse(callback, invalid(result.error));
      broadcastChanged(io, socket.data.roomId!);
      await respondLobbyView(socket, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(SECRET_AGENTS_SYNC_EVENT, (_payload, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (rejectIfGameSyncRateLimited(socket, callback)) return;
    ensureSecretAgentsMatch(io, socket.data.roomId!);
    respondMatchView(callback, socket.data.roomId!, socket.data.playerId!);
  });

  socket.on(SECRET_AGENTS_SUBMIT_CLUE_EVENT, (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['turnId', 'word', 'value'])) {
      return sendGameResponse(callback, invalid('بيانات التلميح غير صالحة.'));
    }
    const roomId = socket.data.roomId!;
    settleSecretAgentsDeadline(io, roomId);
    const match = getSecretAgentsMatch(roomId);
    if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    const error = commitAction(
      io,
      roomId,
      submitSecretAgentsClue(
        match,
        socket.data.playerId!,
        payload as SecretAgentsSubmitCluePayload,
      ),
    );
    if (error) return sendGameResponse(callback, error);
    respondMatchView(callback, roomId, socket.data.playerId!);
  });

  socket.on(SECRET_AGENTS_TOGGLE_NOMINATION_EVENT, (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['turnId', 'cardId', 'requestId'])) {
      return sendGameResponse(callback, invalid('بيانات الترشيح غير صالحة.'));
    }
    const now = Date.now();
    if (now - nominationWindowStartedAt >= 1000) {
      nominationWindowStartedAt = now;
      nominationCount = 0;
    }
    nominationCount += 1;
    if (nominationCount > 20)
      return sendGameResponse(callback, invalid('تمهل قليلًا قبل ترشيح بطاقة أخرى.'));
    const roomId = socket.data.roomId!;
    settleSecretAgentsDeadline(io, roomId, now);
    const match = getSecretAgentsMatch(roomId);
    if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    const error = commitAction(
      io,
      roomId,
      toggleSecretAgentsNomination(
        match,
        socket.data.playerId!,
        payload as SecretAgentsCardActionPayload,
        now,
      ),
    );
    if (error) return sendGameResponse(callback, error);
    respondMatchView(callback, roomId, socket.data.playerId!);
  });

  socket.on(SECRET_AGENTS_CONFIRM_CARD_EVENT, (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['turnId', 'cardId', 'requestId'])) {
      return sendGameResponse(callback, invalid('بيانات التأكيد غير صالحة.'));
    }
    const roomId = socket.data.roomId!;
    const now = Date.now();
    settleSecretAgentsDeadline(io, roomId, now);
    const match = getSecretAgentsMatch(roomId);
    if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    const error = commitAction(
      io,
      roomId,
      confirmSecretAgentsCard(
        match,
        socket.data.playerId!,
        payload as SecretAgentsCardActionPayload,
        now,
      ),
    );
    if (error) return sendGameResponse(callback, error);
    respondMatchView(callback, roomId, socket.data.playerId!);
  });

  socket.on(SECRET_AGENTS_PASS_EVENT, (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['turnId', 'requestId'])) {
      return sendGameResponse(callback, invalid('طلب إنهاء الدور غير صالح.'));
    }
    const roomId = socket.data.roomId!;
    const now = Date.now();
    settleSecretAgentsDeadline(io, roomId, now);
    const match = getSecretAgentsMatch(roomId);
    if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    const error = commitAction(
      io,
      roomId,
      passSecretAgentsTurn(match, socket.data.playerId!, payload as SecretAgentsPassPayload, now),
    );
    if (error) return sendGameResponse(callback, error);
    respondMatchView(callback, roomId, socket.data.playerId!);
  });
}
