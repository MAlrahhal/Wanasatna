import type { Server } from 'socket.io';
import { MOST_LIKELY_TO_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { teardownShellAndReturnToLobby } from '../../game.lifecycle.js';
import { persistCompletedMatchThen } from '../../runtime/persist-completed-match.js';
import { clearMostLikelyToTimerRuntime, restartMostLikelyToTimer } from './phase-timer.js';
import { deleteMostLikelyToMatch, getMostLikelyToMatch, setMostLikelyToMatch } from './store.js';
import { markMostLikelyToPlayerDeparted } from './state.js';

export function cleanupMostLikelyToRuntime(roomId: string): void {
  clearMostLikelyToTimerRuntime(roomId);
  deleteMostLikelyToMatch(roomId);
}

export function reconcileMostLikelyToRuntime(io: Server, roomId: string): void {
  if (!getMostLikelyToMatch(roomId)) return;
  restartMostLikelyToTimer(io, roomId);
  io.to(getRoomChannel(roomId)).emit(MOST_LIKELY_TO_PHASE_CHANGED_EVENT, {});
}

export function handleMostLikelyToPermanentLeave(
  io: Server,
  roomId: string,
  playerId: string,
): void {
  const match = getMostLikelyToMatch(roomId);
  if (!match) return;
  const next = markMostLikelyToPlayerDeparted(match, playerId);
  if (next !== match) setMostLikelyToMatch(roomId, next);
  io.to(getRoomChannel(roomId)).emit(MOST_LIKELY_TO_PHASE_CHANGED_EVENT, {});
}

export function completeMostLikelyToMatch(io: Server, roomId: string): void {
  const match = getMostLikelyToMatch(roomId);
  if (!match || match.phase !== 'completed') return;
  void persistCompletedMatchThen(roomId, () => {
    cleanupMostLikelyToRuntime(roomId);
    teardownShellAndReturnToLobby(io, roomId);
  });
}
