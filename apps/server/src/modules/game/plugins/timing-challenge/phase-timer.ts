import type { Server } from 'socket.io';
import type { TimingChallengeMatchState } from '@wanasatna/shared';
import { TIMING_CHALLENGE_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { completeMatch, startGuessingPhase } from './match-lifecycle.js';
import { getTimingChallengeState, setTimingChallengeState } from './store.js';
import { withRound } from './state.js';

const timersByRoomId = new Map<string, ReturnType<typeof setInterval>>();
const pausedRoomIds = new Set<string>();
/** Wall-clock remaining for Mode A while recovery pauses progression. */
const pausedHiddenRemainingMsByRoomId = new Map<string, number>();

const TIMERLESS_PHASES = new Set<TimingChallengeMatchState['round']['gamePhase']>([
  'ready',
  'guessing',
  'stop-timer',
  'round-results',
]);

const TIMED_TICK_PHASES = new Set<TimingChallengeMatchState['round']['gamePhase']>([
  'hidden-timing',
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

  if (
    remainingMs !== undefined &&
    match?.round.gamePhase === 'hidden-timing'
  ) {
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

/** Clears pause bookkeeping when a match is cleaned up. */
export function clearTimingChallengePhaseTimerRuntime(roomId: string): void {
  stopTimingChallengePhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
  pausedHiddenRemainingMsByRoomId.delete(roomId);
}

function handlePhaseTimerExpired(
  io: Server,
  roomId: string,
  match: TimingChallengeMatchState,
): void {
  if (match.round.gamePhase === 'hidden-timing') {
    startGuessingPhase(io, roomId, match);
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

  if (!match || TIMERLESS_PHASES.has(match.round.gamePhase)) {
    return;
  }

  if (match.round.gamePhase === 'hidden-timing' && match.round.hiddenEndsAtMs) {
    const remainingMs = match.round.hiddenEndsAtMs - Date.now();

    if (remainingMs <= 0) {
      handlePhaseTimerExpired(io, roomId, match);
      return;
    }
  }

  if (match.round.phaseRemainingSeconds <= 0 && match.round.gamePhase === 'match-completed') {
    handlePhaseTimerExpired(io, roomId, match);
    return;
  }

  const intervalId = setInterval(() => {
    const currentMatch = getTimingChallengeState(roomId);

    if (!currentMatch || TIMERLESS_PHASES.has(currentMatch.round.gamePhase)) {
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

    if (TIMED_TICK_PHASES.has(currentMatch.round.gamePhase)) {
      // Mode A: do not broadcast countdown ticks that could leak remaining time.
      if (currentMatch.round.gamePhase !== 'hidden-timing') {
        io.to(getRoomChannel(roomId)).emit(TIMING_CHALLENGE_PHASE_CHANGED_EVENT, {});
      }
    }

    if (remainingSeconds <= 0 && currentMatch.round.gamePhase === 'match-completed') {
      handlePhaseTimerExpired(io, roomId, nextMatch);
    }
  }, 1000);

  timersByRoomId.set(roomId, intervalId);
}
