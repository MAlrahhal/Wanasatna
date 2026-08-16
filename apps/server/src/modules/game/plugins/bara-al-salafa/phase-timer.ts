import type { Server } from 'socket.io';
import type { BaraAlSalafaMatchState } from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import { remainingMsUntilDeadline } from '../../runtime/phase-deadline.js';
import { withRound } from './round-state.js';
import { getBaraAlSalafaState, setBaraAlSalafaState } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setTimeout>>();
const timerGenerationByRoomId = new Map<string, number>();
const pausedRoomIds = new Set<string>();
const pausedRemainingMsByRoomId = new Map<string, number>();

type PhaseExpiredHandler = (
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
) => void;

let phaseExpiredHandler: PhaseExpiredHandler | null = null;

const TIMED_PHASES = new Set<BaraAlSalafaMatchState['round']['gamePhase']>([
  'description',
  'directed-questions',
  'free-questions',
  'voting',
  'reveal-impostor',
  'impostor-guess',
  'impostor-guess-result',
  'round-results',
  'match-completed',
]);

function roundToken(match: BaraAlSalafaMatchState): string {
  const round = match.round;
  return [
    match.currentRound,
    round.gamePhase,
    round.currentSpeakerIndex,
    round.activeFreeQuestionPlayerId ?? '',
    round.pendingFreeQuestionTargetPlayerId ?? '',
  ].join(':');
}

export function registerBaraPhaseExpiredHandler(handler: PhaseExpiredHandler): void {
  phaseExpiredHandler = handler;
}

export function isPhaseTimerPaused(roomId: string): boolean {
  return pausedRoomIds.has(roomId);
}

export function bumpPhaseTimerGeneration(roomId: string): number {
  const next = (timerGenerationByRoomId.get(roomId) ?? 0) + 1;
  timerGenerationByRoomId.set(roomId, next);
  return next;
}

export function pausePhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);

  const match = getBaraAlSalafaState(roomId);

  if (match && TIMED_PHASES.has(match.round.gamePhase)) {
    pausedRemainingMsByRoomId.set(
      roomId,
      remainingMsUntilDeadline(match.round.deadlineAtMs, match.round.phaseRemainingSeconds),
    );
  }

  stopPhaseTimer(roomId);
}

export function resumePhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);

  const remainingMs = pausedRemainingMsByRoomId.get(roomId);
  pausedRemainingMsByRoomId.delete(roomId);

  const match = getBaraAlSalafaState(roomId);

  if (remainingMs !== undefined && match && TIMED_PHASES.has(match.round.gamePhase)) {
    setBaraAlSalafaState(
      roomId,
      withRound(match, {
        ...match.round,
        deadlineAtMs: Date.now() + remainingMs,
        phaseRemainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
      }),
    );
  }

  startPhaseTimerIfNeeded(io, roomId);
}

export function stopPhaseTimer(roomId: string): void {
  const timeoutId = timersByRoomId.get(roomId);

  if (!timeoutId) {
    return;
  }

  clearTimeout(timeoutId);
  timersByRoomId.delete(roomId);
}

export function clearPhaseTimerRuntime(roomId: string): void {
  stopPhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
  pausedRemainingMsByRoomId.delete(roomId);
  timerGenerationByRoomId.delete(roomId);
}

function firePhaseExpiry(
  io: Server,
  roomId: string,
  generation: number,
  scheduledPhase: BaraAlSalafaMatchState['round']['gamePhase'],
  scheduledToken: string,
): void {
  if (timerGenerationByRoomId.get(roomId) !== generation) {
    return;
  }

  stopPhaseTimer(roomId);

  const match = getBaraAlSalafaState(roomId);

  if (
    !match ||
    match.round.gamePhase !== scheduledPhase ||
    roundToken(match) !== scheduledToken
  ) {
    return;
  }

  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.phase !== 'PLAYING') {
    return;
  }

  phaseExpiredHandler?.(io, roomId, match);
}

export function startPhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getBaraAlSalafaState(roomId);

  if (!match || !TIMED_PHASES.has(match.round.gamePhase)) {
    return;
  }

  const generation = timerGenerationByRoomId.get(roomId) ?? bumpPhaseTimerGeneration(roomId);
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

/** Stop any running timer, bump generation, then start if the current phase is timed. */
export function restartPhaseTimer(io: Server, roomId: string): void {
  stopPhaseTimer(roomId);
  bumpPhaseTimerGeneration(roomId);
  startPhaseTimerIfNeeded(io, roomId);
}
