import type { Server } from 'socket.io';
import type { GuessingChallengeMatchState } from '@wanasatna/shared';
import { GUESSING_CHALLENGE_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { completeMatch } from './match-lifecycle.js';
import { withRound } from './state.js';
import { getGuessingChallengeState, setGuessingChallengeState } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setInterval>>();
const pausedRoomIds = new Set<string>();

const TIMERLESS_PHASES = new Set<GuessingChallengeMatchState['round']['gamePhase']>([
  'playing',
  'round-results',
]);

export function pauseGuessingChallengePhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);
  stopGuessingChallengePhaseTimer(roomId);
}

export function resumeGuessingChallengePhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);
  startGuessingChallengePhaseTimerIfNeeded(io, roomId);
}

export function stopGuessingChallengePhaseTimer(roomId: string): void {
  const intervalId = timersByRoomId.get(roomId);

  if (intervalId) {
    clearInterval(intervalId);
    timersByRoomId.delete(roomId);
  }
}

export function clearGuessingChallengePhaseTimerRuntime(roomId: string): void {
  stopGuessingChallengePhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
}

export function startGuessingChallengePhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getGuessingChallengeState(roomId);

  if (!match || TIMERLESS_PHASES.has(match.round.gamePhase)) {
    return;
  }

  if (match.round.phaseRemainingSeconds <= 0 && match.round.gamePhase === 'match-completed') {
    completeMatch(io, roomId);
    return;
  }

  const intervalId = setInterval(() => {
    const currentMatch = getGuessingChallengeState(roomId);

    if (!currentMatch || TIMERLESS_PHASES.has(currentMatch.round.gamePhase)) {
      stopGuessingChallengePhaseTimer(roomId);
      return;
    }

    const shell = getGameShellByRoomId(roomId);

    if (!shell || shell.phase !== 'PLAYING') {
      stopGuessingChallengePhaseTimer(roomId);
      return;
    }

    const remainingSeconds = Math.max(0, currentMatch.round.phaseRemainingSeconds - 1);
    const nextMatch = withRound(currentMatch, {
      ...currentMatch.round,
      phaseRemainingSeconds: remainingSeconds,
    });

    setGuessingChallengeState(roomId, nextMatch);
    io.to(getRoomChannel(roomId)).emit(GUESSING_CHALLENGE_PHASE_CHANGED_EVENT, {});

    if (remainingSeconds <= 0 && currentMatch.round.gamePhase === 'match-completed') {
      completeMatch(io, roomId);
    }
  }, 1000);

  timersByRoomId.set(roomId, intervalId);
}
