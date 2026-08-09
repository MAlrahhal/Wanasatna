import type { Server } from 'socket.io';
import type { WhoWroteItMatchState } from '@wanasatna/shared';
import { WHO_WROTE_IT_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { completeMatch } from './match-lifecycle.js';
import { withRound } from './state.js';
import { getWhoWroteItState, setWhoWroteItState } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setInterval>>();
const pausedRoomIds = new Set<string>();

const TIMERLESS_PHASES = new Set<WhoWroteItMatchState['round']['gamePhase']>([
  'answering',
  'guessing',
  'round-results',
]);

export function isWhoWroteItPhaseTimerPaused(roomId: string): boolean {
  return pausedRoomIds.has(roomId);
}

export function pauseWhoWroteItPhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);
  stopWhoWroteItPhaseTimer(roomId);
}

export function resumeWhoWroteItPhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);
  startWhoWroteItPhaseTimerIfNeeded(io, roomId);
}

export function stopWhoWroteItPhaseTimer(roomId: string): void {
  const intervalId = timersByRoomId.get(roomId);

  if (intervalId) {
    clearInterval(intervalId);
    timersByRoomId.delete(roomId);
  }
}

export function clearWhoWroteItPhaseTimerRuntime(roomId: string): void {
  stopWhoWroteItPhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
}

export function startWhoWroteItPhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getWhoWroteItState(roomId);

  if (!match || TIMERLESS_PHASES.has(match.round.gamePhase)) {
    return;
  }

  if (match.round.phaseRemainingSeconds <= 0 && match.round.gamePhase === 'match-completed') {
    completeMatch(io, roomId);
    return;
  }

  const intervalId = setInterval(() => {
    const currentMatch = getWhoWroteItState(roomId);

    if (!currentMatch || TIMERLESS_PHASES.has(currentMatch.round.gamePhase)) {
      stopWhoWroteItPhaseTimer(roomId);
      return;
    }

    const shell = getGameShellByRoomId(roomId);

    if (!shell || shell.phase !== 'PLAYING') {
      stopWhoWroteItPhaseTimer(roomId);
      return;
    }

    const remainingSeconds = Math.max(0, currentMatch.round.phaseRemainingSeconds - 1);
    const nextMatch = withRound(currentMatch, {
      ...currentMatch.round,
      phaseRemainingSeconds: remainingSeconds,
    });

    setWhoWroteItState(roomId, nextMatch);
    io.to(getRoomChannel(roomId)).emit(WHO_WROTE_IT_PHASE_CHANGED_EVENT, {});

    if (remainingSeconds <= 0 && currentMatch.round.gamePhase === 'match-completed') {
      completeMatch(io, roomId);
    }
  }, 1000);

  timersByRoomId.set(roomId, intervalId);
}
