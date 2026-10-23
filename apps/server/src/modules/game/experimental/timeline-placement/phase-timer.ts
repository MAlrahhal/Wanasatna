import type { Server } from 'socket.io';
import {
  TIMELINE_PLACEMENT_GAME_ID,
  TIMELINE_PLACEMENT_PHASE_CHANGED_EVENT,
} from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { completeTimelinePlacementMatch } from './match-lifecycle.js';
import { expireTimelinePlacementPhase, handleTimelinePlacementPermanentLeave } from './state.js';
import { getTimelinePlacementMatch, setTimelinePlacementMatch } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setTimeout>>();
const generationsByRoomId = new Map<string, number>();

export function stopTimelinePlacementTimer(roomId: string): void {
  const timer = timersByRoomId.get(roomId);
  if (timer) clearTimeout(timer);
  timersByRoomId.delete(roomId);
}

export function clearTimelinePlacementTimerRuntime(roomId: string): void {
  stopTimelinePlacementTimer(roomId);
  generationsByRoomId.delete(roomId);
}

function broadcast(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(TIMELINE_PLACEMENT_PHASE_CHANGED_EVENT, {});
}

export function restartTimelinePlacementTimer(io: Server, roomId: string): void {
  stopTimelinePlacementTimer(roomId);
  const match = getTimelinePlacementMatch(roomId);
  if (!match?.round.deadlineAtMs) return;
  const generation = (generationsByRoomId.get(roomId) ?? 0) + 1;
  generationsByRoomId.set(roomId, generation);
  const expectedRoundId = match.round.roundId;
  const expectedPhase = match.round.phase;
  const delay = Math.max(0, match.round.deadlineAtMs - Date.now());
  timersByRoomId.set(
    roomId,
    setTimeout(() => {
      if (generationsByRoomId.get(roomId) !== generation) return;
      timersByRoomId.delete(roomId);
      const current = getTimelinePlacementMatch(roomId);
      if (
        !current ||
        current.round.roundId !== expectedRoundId ||
        current.round.phase !== expectedPhase
      ) {
        return;
      }
      if (current.round.phase === 'completed') {
        completeTimelinePlacementMatch(io, roomId);
        return;
      }
      const expired = expireTimelinePlacementPhase(current, expectedRoundId, expectedPhase);
      if (expired) {
        setTimelinePlacementMatch(roomId, expired);
        broadcast(io, roomId);
      }
      restartTimelinePlacementTimer(io, roomId);
    }, delay),
  );
}

export function settleTimelinePlacementDeadline(
  io: Server,
  roomId: string,
  now = Date.now(),
): boolean {
  const match = getTimelinePlacementMatch(roomId);
  if (!match || match.round.phase === 'completed') return false;
  const expired = expireTimelinePlacementPhase(match, match.round.roundId, match.round.phase, now);
  if (!expired) return false;
  setTimelinePlacementMatch(roomId, expired);
  broadcast(io, roomId);
  restartTimelinePlacementTimer(io, roomId);
  return true;
}

/** Disconnects never pause or extend the authoritative round deadline. */
export function reconcileTimelinePlacementConnectivity(io: Server, roomId: string): void {
  const shell = getGameShellByRoomId(roomId);
  if (!shell || shell.gameId !== TIMELINE_PLACEMENT_GAME_ID || !getTimelinePlacementMatch(roomId)) {
    return;
  }
  restartTimelinePlacementTimer(io, roomId);
}

export function onTimelinePlacementPermanentLeave(
  io: Server,
  roomId: string,
  playerId: string,
): void {
  const match = getTimelinePlacementMatch(roomId);
  if (!match) return;
  const next = handleTimelinePlacementPermanentLeave(match, playerId);
  if (next === match) return;
  setTimelinePlacementMatch(roomId, next);
  broadcast(io, roomId);
  restartTimelinePlacementTimer(io, roomId);
}
