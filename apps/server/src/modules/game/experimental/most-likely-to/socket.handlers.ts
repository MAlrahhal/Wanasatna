import type { Server, Socket } from 'socket.io';
import type {
  GameActionResponse,
  MostLikelyToAdvancePayload,
  MostLikelyToPlayerView,
  MostLikelyToVotePayload,
} from '@wanasatna/shared';
import {
  MOST_LIKELY_TO_ADVANCE_EVENT,
  MOST_LIKELY_TO_GAME_ID,
  MOST_LIKELY_TO_MAX_PLAYERS,
  MOST_LIKELY_TO_PHASE_CHANGED_EVENT,
  MOST_LIKELY_TO_SYNC_EVENT,
  MOST_LIKELY_TO_VOTE_EVENT,
} from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import {
  assertGameShellHost,
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
import { queuePromotionPersistence } from '../../runtime/absorb-spectators-for-next-round.js';
import { ensureMostLikelyToMatch } from './init-match.js';
import { completeMostLikelyToMatch } from './match-lifecycle.js';
import {
  clearMostLikelyToTimerRuntime,
  restartMostLikelyToTimer,
  settleMostLikelyToRoomDeadline,
} from './phase-timer.js';
import {
  buildMostLikelyToPlayerView,
  startNextMostLikelyToQuestion,
  voteMostLikelyTo,
} from './state.js';
import { getMostLikelyToMatch, setMostLikelyToMatch } from './store.js';

type ViewResponse = GameActionResponse<{ view: MostLikelyToPlayerView }>;

function invalid(message: string): Extract<GameActionResponse<never>, { success: false }> {
  return { success: false, error: { code: 'VALIDATION_ERROR', message } };
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
  io.to(getRoomChannel(roomId)).emit(MOST_LIKELY_TO_PHASE_CHANGED_EVENT, {});
}

async function currentView(
  io: Server,
  roomId: string,
  playerId: string,
): Promise<MostLikelyToPlayerView | null> {
  settleMostLikelyToRoomDeadline(io, roomId);
  await syncGameShell(roomId);
  const shell = getGameShellByRoomId(roomId);
  const match = getMostLikelyToMatch(roomId) ?? ensureMostLikelyToMatch(io, roomId);
  if (!shell || shell.gameId !== MOST_LIKELY_TO_GAME_ID || !match) return null;
  return buildMostLikelyToPlayerView(match, playerId, shell);
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

async function promoteWaitingPlayers(
  io: Server,
  roomId: string,
): Promise<Array<{ playerId: string; name: string }>> {
  await syncGameShell(roomId);
  let shell = getGameShellByRoomId(roomId);
  const match = getMostLikelyToMatch(roomId);
  if (!shell || !match) return [];

  const participants = match.playerIds
    .filter((playerId) => !match.departedPlayerIds.includes(playerId))
    .map((playerId) => ({ playerId, name: match.playerNames[playerId] ?? 'لاعب' }));
  const promotedIds: string[] = [];

  for (const player of shell.players) {
    if (
      participants.length >= MOST_LIKELY_TO_MAX_PLAYERS ||
      !player.isConnected ||
      match.playerIds.includes(player.id)
    ) {
      continue;
    }
    const promoted = promotePlayerIntoActiveMatch(roomId, player.id, MOST_LIKELY_TO_MAX_PLAYERS);
    if (!promoted) continue;
    shell = promoted;
    promotedIds.push(player.id);
    participants.push({ playerId: player.id, name: player.name });
  }

  if (promotedIds.length > 0) {
    await queuePromotionPersistence(io, roomId, promotedIds);
    broadcastGameShellState(io, shell);
  }
  return participants;
}

export function registerMostLikelyToSocketHandlers(io: Server, socket: Socket): void {
  socket.on(MOST_LIKELY_TO_SYNC_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, [])) {
      return sendGameResponse(callback, invalid('طلب المزامنة غير صالح.'));
    }
    if (rejectIfGameSyncRateLimited(socket, callback)) return;
    try {
      await respondView(io, socket.data.roomId!, socket.data.playerId!, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(MOST_LIKELY_TO_VOTE_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['questionId', 'nomineePlayerId', 'requestId'])) {
      return sendGameResponse(callback, invalid('بيانات التصويت غير صالحة.'));
    }
    const roomId = socket.data.roomId!;
    const playerId = socket.data.playerId!;
    try {
      settleMostLikelyToRoomDeadline(io, roomId);
      const match = getMostLikelyToMatch(roomId);
      if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
      const result = voteMostLikelyTo(match, playerId, payload as MostLikelyToVotePayload);
      if (!result.ok) return sendGameResponse(callback, invalid(result.message));
      if (result.changed) {
        setMostLikelyToMatch(roomId, result.match);
        if (result.match.phase === 'voting') restartMostLikelyToTimer(io, roomId);
        else clearMostLikelyToTimerRuntime(roomId);
        broadcastChanged(io, roomId);
      }
      await respondView(io, roomId, playerId, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(MOST_LIKELY_TO_ADVANCE_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['questionId', 'requestId'])) {
      return sendGameResponse(callback, invalid('طلب الانتقال غير صالح.'));
    }
    const roomId = socket.data.roomId!;
    const playerId = socket.data.playerId!;
    try {
      const host = await assertGameShellHost(roomId, playerId);
      if (!host.success) return sendGameResponse(callback, host);
      settleMostLikelyToRoomDeadline(io, roomId);
      const match = getMostLikelyToMatch(roomId);
      if (!match || payload === null || typeof payload !== 'object') {
        return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
      }
      const action = payload as MostLikelyToAdvancePayload;
      if (
        typeof action.questionId !== 'string' ||
        typeof action.requestId !== 'string' ||
        action.requestId.length < 8 ||
        action.requestId.length > 100
      ) {
        return sendGameResponse(callback, invalid('طلب الانتقال غير صالح.'));
      }
      if (action.questionId !== match.currentQuestion.questionId) {
        return sendGameResponse(callback, invalid('هذا الطلب يخص سؤالًا سابقًا.'));
      }
      if (match.phase === 'completed') {
        const view = await currentView(io, roomId, playerId);
        if (!view) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
        sendGameResponse(callback, { success: true, data: { view } });
        completeMostLikelyToMatch(io, roomId);
        return;
      }
      const participants = await promoteWaitingPlayers(io, roomId);
      const latestMatch = getMostLikelyToMatch(roomId);
      if (!latestMatch) {
        return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
      }
      if (action.questionId !== latestMatch.currentQuestion.questionId) {
        if (latestMatch.processedRequestIds.includes(action.requestId)) {
          await respondView(io, roomId, playerId, callback);
          return;
        }
        return sendGameResponse(callback, invalid('هذا الطلب يخص سؤالًا سابقًا.'));
      }
      const result = startNextMostLikelyToQuestion(latestMatch, participants, action.requestId);
      if (!result.ok) return sendGameResponse(callback, invalid(result.message));
      if (result.changed) {
        setMostLikelyToMatch(roomId, result.match);
        restartMostLikelyToTimer(io, roomId);
        broadcastChanged(io, roomId);
      }
      await respondView(io, roomId, playerId, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });
}
