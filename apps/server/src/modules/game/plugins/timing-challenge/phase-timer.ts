import type { Server } from 'socket.io';
import type { TimingChallengeMatchState } from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import { remainingMsUntilDeadline } from '../../runtime/phase-deadline.js';
import {
  advanceFromReady,
  advanceFromRoundResults,
  completeMatch,
  startGuessingPhase,
  startRoundResults,
} from './match-lifecycle.js';
import { withRound } from './state.js';
import { getTimingChallengeState, setTimingChallengeState } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setTimeout>>();
const timerGenerationByRoomId = new Map<string, number>();
const pausedRoomIds = new Set<string>();
const pausedRemainingMsByRoomId = new Map<string, number>();

const TIMED_PHASES = new Set<TimingChallengeMatchState['round']['gamePhase']>([
  'ready',
  'hidden-timing',
  'guessing',
  'stop-timer',
  'round-results',
  'match-completed',
]);

function roundToken(match: TimingChallengeMatchState): string {
  return `${match.currentRound}:${match.round.gamePhase}:${match.round.roundId}`;
}

function bumpGeneration(roomId: string): number {
  const next = (timerGenerationByRoomId.get(roomId) ?? 0) + 1;
  timerGenerationByRoomId.set(roomId, next);
  return next;
}

function remainingMsForMatch(match: TimingChallengeMatchState): number {
  if (match.round.gamePhase === 'hidden-timing') {
    return remainingMsUntilDeadline(match.round.hiddenEndsAtMs, 0);
  }

  return remainingMsUntilDeadline(match.round.deadlineAtMs, match.round.phaseRemainingSeconds);
}

export function isTimingChallengePhaseTimerPaused(roomId: string): boolean {
  return pausedRoomIds.has(roomId);
}

export function pauseTimingChallengePhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);

  const match = getTimingChallengeState(roomId);

  if (match && TIMED_PHASES.has(match.round.gamePhase)) {
    pausedRemainingMsByRoomId.set(roomId, remainingMsForMatch(match));
  }

  stopTimingChallengePhaseTimer(roomId);
}

export function resumeTimingChallengePhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);

  const remainingMs = pausedRemainingMsByRoomId.get(roomId);
  pausedRemainingMsByRoomId.delete(roomId);

  const match = getTimingChallengeState(roomId);

  if (remainingMs !== undefined && match && TIMED_PHASES.has(match.round.gamePhase)) {
    const nextDeadline = Date.now() + remainingMs;
    setTimingChallengeState(
      roomId,
      withRound(match, {
        ...match.round,
        hiddenEndsAtMs:
          match.round.gamePhase === 'hidden-timing' ? nextDeadline : match.round.hiddenEndsAtMs,
        deadlineAtMs:
          match.round.gamePhase === 'hidden-timing' ? match.round.deadlineAtMs : nextDeadline,
        phaseRemainingSeconds:
          match.round.gamePhase === 'hidden-timing'
            ? match.round.phaseRemainingSeconds
            : Math.max(0, Math.ceil(remainingMs / 1000)),
      }),
    );
  }

  startTimingChallengePhaseTimerIfNeeded(io, roomId);
}

export function stopTimingChallengePhaseTimer(roomId: string): void {
  const timeoutId = timersByRoomId.get(roomId);

  if (timeoutId) {
    clearTimeout(timeoutId);
    timersByRoomId.delete(roomId);
  }
}

export function clearTimingChallengePhaseTimerRuntime(roomId: string): void {
  stopTimingChallengePhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
  pausedRemainingMsByRoomId.delete(roomId);
  timerGenerationByRoomId.delete(roomId);
}

export function restartTimingChallengePhaseTimer(io: Server, roomId: string): void {
  stopTimingChallengePhaseTimer(roomId);
  bumpGeneration(roomId);
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

function firePhaseExpiry(
  io: Server,
  roomId: string,
  generation: number,
  scheduledPhase: TimingChallengeMatchState['round']['gamePhase'],
  scheduledToken: string,
): void {
  if (timerGenerationByRoomId.get(roomId) !== generation) {
    return;
  }

  stopTimingChallengePhaseTimer(roomId);

  const match = getTimingChallengeState(roomId);

  if (
    !match ||
    match.round.gamePhase !== scheduledPhase ||
    roundToken(match) !== scheduledToken
  ) {
    return;
  }

  handlePhaseTimerExpired(io, roomId, match);
}

export function startTimingChallengePhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getTimingChallengeState(roomId);

  if (!match || !TIMED_PHASES.has(match.round.gamePhase)) {
    return;
  }

  const generation = timerGenerationByRoomId.get(roomId) ?? bumpGeneration(roomId);
  const scheduledPhase = match.round.gamePhase;
  const scheduledToken = roundToken(match);
  const delayMs = remainingMsForMatch(match);

  if (delayMs <= 0) {
    firePhaseExpiry(io, roomId, generation, scheduledPhase, scheduledToken);
    return;
  }

  const timeoutId = setTimeout(() => {
    firePhaseExpiry(io, roomId, generation, scheduledPhase, scheduledToken);
  }, delayMs);

  timersByRoomId.set(roomId, timeoutId);
}
