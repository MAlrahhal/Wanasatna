import type { Server } from 'socket.io';
import type { FastAnswerMatchState } from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import { remainingMsUntilDeadline } from '../../runtime/phase-deadline.js';
import {
  advanceFromRoundResults,
  completeMatch,
  finalizeQuestionRound,
} from './match-lifecycle.js';
import { withRound } from './state.js';
import { getFastAnswerState, setFastAnswerState } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setTimeout>>();
const timerGenerationByRoomId = new Map<string, number>();
const pausedRoomIds = new Set<string>();
const pausedQuestionRemainingMsByRoomId = new Map<string, number>();

const TIMED_PHASES = new Set<FastAnswerMatchState['round']['gamePhase']>([
  'question',
  'round-results',
  'match-completed',
]);

function roundToken(match: FastAnswerMatchState): string {
  return `${match.currentRound}:${match.round.gamePhase}:${match.round.roundId}`;
}

function bumpGeneration(roomId: string): number {
  const next = (timerGenerationByRoomId.get(roomId) ?? 0) + 1;
  timerGenerationByRoomId.set(roomId, next);
  return next;
}

export function isFastAnswerPhaseTimerPaused(roomId: string): boolean {
  return pausedRoomIds.has(roomId);
}

export function pauseFastAnswerPhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);

  const match = getFastAnswerState(roomId);

  if (match && TIMED_PHASES.has(match.round.gamePhase)) {
    pausedQuestionRemainingMsByRoomId.set(
      roomId,
      remainingMsUntilDeadline(match.round.deadlineAtMs, match.round.phaseRemainingSeconds),
    );
  }

  stopFastAnswerPhaseTimer(roomId);
}

export function resumeFastAnswerPhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);

  const remainingMs = pausedQuestionRemainingMsByRoomId.get(roomId);
  pausedQuestionRemainingMsByRoomId.delete(roomId);

  const match = getFastAnswerState(roomId);

  if (remainingMs !== undefined && match && TIMED_PHASES.has(match.round.gamePhase)) {
    setFastAnswerState(
      roomId,
      withRound(match, {
        ...match.round,
        deadlineAtMs: Date.now() + remainingMs,
        phaseRemainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
      }),
    );
  }

  startFastAnswerPhaseTimerIfNeeded(io, roomId);
}

export function stopFastAnswerPhaseTimer(roomId: string): void {
  const timeoutId = timersByRoomId.get(roomId);

  if (timeoutId) {
    clearTimeout(timeoutId);
    timersByRoomId.delete(roomId);
  }
}

export function clearFastAnswerPhaseTimerRuntime(roomId: string): void {
  stopFastAnswerPhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
  pausedQuestionRemainingMsByRoomId.delete(roomId);
  timerGenerationByRoomId.delete(roomId);
}

export function restartFastAnswerPhaseTimer(io: Server, roomId: string): void {
  stopFastAnswerPhaseTimer(roomId);
  bumpGeneration(roomId);
  startFastAnswerPhaseTimerIfNeeded(io, roomId);
}

function handlePhaseTimerExpired(
  io: Server,
  roomId: string,
  match: FastAnswerMatchState,
): void {
  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.phase !== 'PLAYING') {
    stopFastAnswerPhaseTimer(roomId);
    return;
  }

  if (match.round.gamePhase === 'question') {
    finalizeQuestionRound(io, roomId, match, {
      winnerPlayerId: match.round.winnerPlayerId,
      timedOut: match.round.winnerPlayerId === null,
    });
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
  scheduledPhase: FastAnswerMatchState['round']['gamePhase'],
  scheduledToken: string,
): void {
  if (timerGenerationByRoomId.get(roomId) !== generation) {
    return;
  }

  stopFastAnswerPhaseTimer(roomId);

  const match = getFastAnswerState(roomId);

  if (
    !match ||
    match.round.gamePhase !== scheduledPhase ||
    roundToken(match) !== scheduledToken
  ) {
    return;
  }

  handlePhaseTimerExpired(io, roomId, match);
}

export function startFastAnswerPhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getFastAnswerState(roomId);

  if (!match || !TIMED_PHASES.has(match.round.gamePhase)) {
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
