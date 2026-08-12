import type { Server } from 'socket.io';
import type { TimingChallengeMatchState } from '@wanasatna/shared';
import { TIMING_CHALLENGE_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import {
  advanceFromReady,
  advanceFromRoundResults,
  completeMatch,
  startGuessingPhase,
  startRoundResults,
} from './match-lifecycle.js';
import { getTimingChallengeState, setTimingChallengeState } from './store.js';
import { withRound } from './state.js';

const timersByRoomId = new Map<string, ReturnType<typeof setInterval>>();
const pausedRoomIds = new Set<string>();
const pausedHiddenRemainingMsByRoomId = new Map<string, number>();

const TIMED_PHASES = new Set<TimingChallengeMatchState['round']['gamePhase']>([
  'ready',
  'hidden-timing',
  'guessing',
  'stop-timer',
  'round-results',
  'match-completed',
]);

export function isTimingChallengePhaseTimerPaused(roomId: string): boolean {
  return pausedRoomIds.has(roomId);
}

export function pauseTimingChallengePhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);

  const match = getTimingChallengeState(roomId);

  if (match?.round.gamePhase === 'hidden-timing' && match.round.hiddenEndsAtMs) {
    pausedHiddenRemainingMsByRoomId.set(
      roomId,
      Math.max(0, match.round.hiddenEndsAtMs - Date.now()),
    );
  }

  stopTimingChallengePhaseTimer(roomId);
}

export function resumeTimingChallengePhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);

  const remainingMs = pausedHiddenRemainingMsByRoomId.get(roomId);
  pausedHiddenRemainingMsByRoomId.delete(roomId);

  const match = getTimingChallengeState(roomId);

  if (remainingMs !== undefined && match?.round.gamePhase === 'hidden-timing') {
    setTimingChallengeState(
      roomId,
      withRound(match, {
        ...match.round,
        hiddenEndsAtMs: Date.now() + remainingMs,
        phaseRemainingSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
      }),
    );
  }

  startTimingChallengePhaseTimerIfNeeded(io, roomId);
}

export function stopTimingChallengePhaseTimer(roomId: string): void {
  const intervalId = timersByRoomId.get(roomId);

  if (intervalId) {
    clearInterval(intervalId);
    timersByRoomId.delete(roomId);
  }
}

export function clearTimingChallengePhaseTimerRuntime(roomId: string): void {
  stopTimingChallengePhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
  pausedHiddenRemainingMsByRoomId.delete(roomId);
}

export function restartTimingChallengePhaseTimer(io: Server, roomId: string): void {
  stopTimingChallengePhaseTimer(roomId);
  startTimingChallengePhaseTimerIfNeeded(io, roomId);
}

function handlePhaseTimerExpired(
  io: Server,
  roomId: string,
  match: TimingChallengeMatchState,
): void {
  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.phase !== 'PLAYING') {
    stopTimingChallengePhaseTimer(roomId);
    return;
  }

  if (match.round.gamePhase === 'ready') {
    advanceFromReady(io, roomId, match);
    return;
  }

  if (match.round.gamePhase === 'hidden-timing') {
    startGuessingPhase(io, roomId, match);
    return;
  }

  if (match.round.gamePhase === 'guessing' || match.round.gamePhase === 'stop-timer') {
    startRoundResults(io, roomId, match);
    return;
  }

  if (match.round.gamePhase === 'round-results') {
    advanceFromRoundResults(io, roomId, match);
    return;
  }

  if (match.round.gamePhase === 'match-completed') {
    completeMatch(io, roomId);
  }
}

export function startTimingChallengePhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getTimingChallengeState(roomId);

  if (!match || !TIMED_PHASES.has(match.round.gamePhase)) {
    return;
  }

  if (match.round.gamePhase === 'hidden-timing' && match.round.hiddenEndsAtMs) {
    if (match.round.hiddenEndsAtMs - Date.now() <= 0) {
      handlePhaseTimerExpired(io, roomId, match);
      return;
    }
  } else if (match.round.phaseRemainingSeconds <= 0) {
    handlePhaseTimerExpired(io, roomId, match);
    return;
  }

  const intervalId = setInterval(() => {
    const currentMatch = getTimingChallengeState(roomId);

    if (!currentMatch || !TIMED_PHASES.has(currentMatch.round.gamePhase)) {
      stopTimingChallengePhaseTimer(roomId);
      return;
    }

    const shell = getGameShellByRoomId(roomId);

    if (!shell || shell.phase !== 'PLAYING') {
      stopTimingChallengePhaseTimer(roomId);
      return;
    }

    if (
      currentMatch.round.gamePhase === 'hidden-timing' &&
      currentMatch.round.hiddenEndsAtMs &&
      Date.now() >= currentMatch.round.hiddenEndsAtMs
    ) {
      stopTimingChallengePhaseTimer(roomId);
      handlePhaseTimerExpired(io, roomId, currentMatch);
      return;
    }

    const remainingSeconds = Math.max(0, currentMatch.round.phaseRemainingSeconds - 1);
    const nextMatch = withRound(currentMatch, {
      ...currentMatch.round,
      phaseRemainingSeconds: remainingSeconds,
    });

    setTimingChallengeState(roomId, nextMatch);

    // Mode A: do not broadcast countdown ticks that could leak remaining time.
    if (currentMatch.round.gamePhase !== 'hidden-timing') {
      io.to(getRoomChannel(roomId)).emit(TIMING_CHALLENGE_PHASE_CHANGED_EVENT, {});
    }

    if (remainingSeconds <= 0 && currentMatch.round.gamePhase !== 'hidden-timing') {
      handlePhaseTimerExpired(io, roomId, nextMatch);
    }
  }, 1000);

  timersByRoomId.set(roomId, intervalId);
}
