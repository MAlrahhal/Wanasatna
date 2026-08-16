import type { Server } from 'socket.io';
import type { ImposterDrawMatchState } from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import { remainingMsUntilDeadline } from '../../runtime/phase-deadline.js';
import {
  advanceDrawingTurn,
  advanceFromRoundResults,
  completeMatch,
  completeRevealPhase,
  completeVotingPhase,
  finalizeImageGuessWithoutSubmission,
  startDrawingPhase,
  startRoundResults,
} from './match-lifecycle.js';
import { withRound } from './state.js';
import { getImposterDrawState, setImposterDrawState } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setTimeout>>();
const timerGenerationByRoomId = new Map<string, number>();
const pausedRoomIds = new Set<string>();
const pausedRemainingMsByRoomId = new Map<string, number>();

const TIMED_PHASES = new Set<ImposterDrawMatchState['round']['gamePhase']>([
  'briefing',
  'drawing-turns',
  'voting',
  'reveal',
  'impostor-guess',
  'guess-result',
  'round-results',
  'match-completed',
]);

function roundToken(match: ImposterDrawMatchState): string {
  return `${match.currentRound}:${match.round.gamePhase}:${match.round.turnId}:${match.round.currentDrawerIndex}`;
}

function bumpGeneration(roomId: string): number {
  const next = (timerGenerationByRoomId.get(roomId) ?? 0) + 1;
  timerGenerationByRoomId.set(roomId, next);
  return next;
}

export function isImposterDrawPhaseTimerPaused(roomId: string): boolean {
  return pausedRoomIds.has(roomId);
}

export function pauseImposterDrawPhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);

  const match = getImposterDrawState(roomId);

  if (match && TIMED_PHASES.has(match.round.gamePhase)) {
    pausedRemainingMsByRoomId.set(
      roomId,
      remainingMsUntilDeadline(match.round.deadlineAtMs, match.round.phaseRemainingSeconds),
    );
  }

  stopImposterDrawPhaseTimer(roomId);
}

export function resumeImposterDrawPhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);

  const remainingMs = pausedRemainingMsByRoomId.get(roomId);
  pausedRemainingMsByRoomId.delete(roomId);

  const match = getImposterDrawState(roomId);

  if (remainingMs !== undefined && match && TIMED_PHASES.has(match.round.gamePhase)) {
    setImposterDrawState(
      roomId,
      withRound(match, {
        ...match.round,
        deadlineAtMs: Date.now() + remainingMs,
        phaseRemainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
      }),
    );
  }

  startImposterDrawPhaseTimerIfNeeded(io, roomId);
}

export function stopImposterDrawPhaseTimer(roomId: string): void {
  const timeoutId = timersByRoomId.get(roomId);

  if (!timeoutId) {
    return;
  }

  clearTimeout(timeoutId);
  timersByRoomId.delete(roomId);
}

export function clearImposterDrawPhaseTimerRuntime(roomId: string): void {
  stopImposterDrawPhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
  pausedRemainingMsByRoomId.delete(roomId);
  timerGenerationByRoomId.delete(roomId);
}

export function restartImposterDrawPhaseTimer(io: Server, roomId: string): void {
  stopImposterDrawPhaseTimer(roomId);
  bumpGeneration(roomId);
  startImposterDrawPhaseTimerIfNeeded(io, roomId);
}

function handlePhaseTimerExpired(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
): void {
  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.phase !== 'PLAYING') {
    stopImposterDrawPhaseTimer(roomId);
    return;
  }

  if (match.round.gamePhase === 'briefing') {
    startDrawingPhase(io, roomId, match);
    return;
  }

  if (match.round.gamePhase === 'drawing-turns') {
    advanceDrawingTurn(io, roomId, match);
    return;
  }

  if (match.round.gamePhase === 'voting') {
    completeVotingPhase(io, roomId, match);
    return;
  }

  if (match.round.gamePhase === 'reveal') {
    completeRevealPhase(io, roomId, match);
    return;
  }

  if (match.round.gamePhase === 'impostor-guess') {
    finalizeImageGuessWithoutSubmission(io, roomId, match);
    return;
  }

  if (match.round.gamePhase === 'guess-result') {
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
  scheduledPhase: ImposterDrawMatchState['round']['gamePhase'],
  scheduledToken: string,
): void {
  if (timerGenerationByRoomId.get(roomId) !== generation) {
    return;
  }

  stopImposterDrawPhaseTimer(roomId);

  const match = getImposterDrawState(roomId);

  if (
    !match ||
    match.round.gamePhase !== scheduledPhase ||
    roundToken(match) !== scheduledToken
  ) {
    return;
  }

  handlePhaseTimerExpired(io, roomId, match);
}

export function startImposterDrawPhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getImposterDrawState(roomId);

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
