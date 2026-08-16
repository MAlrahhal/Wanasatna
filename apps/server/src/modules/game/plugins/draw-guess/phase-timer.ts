import type { Server } from 'socket.io';
import type { DrawGuessMatchState } from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import { remainingMsUntilDeadline } from '../../runtime/phase-deadline.js';
import {
  advanceFromRoundResults,
  completeMatch,
  endDrawingRound,
} from './match-lifecycle.js';
import { withRound } from './state.js';
import { getDrawGuessState, setDrawGuessState } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setTimeout>>();
const timerGenerationByRoomId = new Map<string, number>();
const pausedRoomIds = new Set<string>();
const pausedRemainingMsByRoomId = new Map<string, number>();

const TIMED_TICK_PHASES = new Set<DrawGuessMatchState['round']['gamePhase']>([
  'drawing',
  'round-results',
  'match-completed',
]);

function roundToken(match: DrawGuessMatchState): string {
  return `${match.currentRound}:${match.round.gamePhase}:${match.round.turnId}`;
}

function bumpGeneration(roomId: string): number {
  const next = (timerGenerationByRoomId.get(roomId) ?? 0) + 1;
  timerGenerationByRoomId.set(roomId, next);
  return next;
}

export function isDrawGuessPhaseTimerPaused(roomId: string): boolean {
  return pausedRoomIds.has(roomId);
}

export function pauseDrawGuessPhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);

  const match = getDrawGuessState(roomId);

  if (match && TIMED_TICK_PHASES.has(match.round.gamePhase)) {
    pausedRemainingMsByRoomId.set(
      roomId,
      remainingMsUntilDeadline(match.round.deadlineAtMs, match.round.phaseRemainingSeconds),
    );
  }

  stopDrawGuessPhaseTimer(roomId);
}

export function resumeDrawGuessPhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);

  const remainingMs = pausedRemainingMsByRoomId.get(roomId);
  pausedRemainingMsByRoomId.delete(roomId);

  const match = getDrawGuessState(roomId);

  if (remainingMs !== undefined && match && TIMED_TICK_PHASES.has(match.round.gamePhase)) {
    setDrawGuessState(
      roomId,
      withRound(match, {
        ...match.round,
        deadlineAtMs: Date.now() + remainingMs,
        phaseRemainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
      }),
    );
  }

  startDrawGuessPhaseTimerIfNeeded(io, roomId);
}

export function stopDrawGuessPhaseTimer(roomId: string): void {
  const timeoutId = timersByRoomId.get(roomId);

  if (!timeoutId) {
    return;
  }

  clearTimeout(timeoutId);
  timersByRoomId.delete(roomId);
}

export function clearDrawGuessPhaseTimerRuntime(roomId: string): void {
  stopDrawGuessPhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
  pausedRemainingMsByRoomId.delete(roomId);
  timerGenerationByRoomId.delete(roomId);
}

export function restartDrawGuessPhaseTimer(io: Server, roomId: string): void {
  stopDrawGuessPhaseTimer(roomId);
  bumpGeneration(roomId);
  startDrawGuessPhaseTimerIfNeeded(io, roomId);
}

function handlePhaseTimerExpired(
  io: Server,
  roomId: string,
  match: DrawGuessMatchState,
): void {
  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.phase !== 'PLAYING') {
    stopDrawGuessPhaseTimer(roomId);
    return;
  }

  if (match.round.gamePhase === 'drawing') {
    endDrawingRound(io, roomId, match, {
      guessedCorrectly: false,
      correctGuesserPlayerId: null,
    });
    return;
  }

  if (match.round.gamePhase === 'round-results') {
    advanceFromRoundResults(io, roomId, match, shell);
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
  scheduledPhase: DrawGuessMatchState['round']['gamePhase'],
  scheduledToken: string,
): void {
  if (timerGenerationByRoomId.get(roomId) !== generation) {
    return;
  }

  stopDrawGuessPhaseTimer(roomId);

  const match = getDrawGuessState(roomId);

  if (
    !match ||
    match.round.gamePhase !== scheduledPhase ||
    roundToken(match) !== scheduledToken
  ) {
    return;
  }

  handlePhaseTimerExpired(io, roomId, match);
}

export function startDrawGuessPhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getDrawGuessState(roomId);

  if (!match || !TIMED_TICK_PHASES.has(match.round.gamePhase)) {
    return;
  }

  const generation = timerGenerationByRoomId.get(roomId) ?? bumpGeneration(roomId);
  const scheduledPhase = match.round.gamePhase;
  const scheduledToken = roundToken(match);
  const delayMs = remainingMsUntilDeadline(
    match.round.deadlineAtMs,
    match.round.phaseRemainingSeconds,
  );

  if (delayMs <= 0) {
    firePhaseExpiry(io, roomId, generation, scheduledPhase, scheduledToken);
    return;
  }

  const timeoutId = setTimeout(() => {
    firePhaseExpiry(io, roomId, generation, scheduledPhase, scheduledToken);
  }, delayMs);

  timersByRoomId.set(roomId, timeoutId);
}
