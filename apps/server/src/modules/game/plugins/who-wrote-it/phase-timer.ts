import type { Server } from 'socket.io';
import type { WhoWroteItMatchState } from '@wanasatna/shared';
import { WHO_WROTE_IT_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { remainingMsUntilDeadline } from '../../runtime/phase-deadline.js';
import {
  advanceFromRoundResults,
  completeMatch,
  startRoundResults,
  transitionToGuessing,
} from './match-lifecycle.js';
import { advanceGlobalAnswerOrComplete, withRound } from './state.js';
import { getWhoWroteItState, setWhoWroteItState } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setTimeout>>();
const timerGenerationByRoomId = new Map<string, number>();
const pausedRoomIds = new Set<string>();
const pausedDeadlineRemainingMsByRoomId = new Map<string, number>();

const TIMED_PHASES = new Set<WhoWroteItMatchState['round']['gamePhase']>([
  'answering',
  'guessing',
  'round-results',
  'match-completed',
]);

function roundToken(match: WhoWroteItMatchState): string {
  return `${match.currentRound}:${match.round.gamePhase}:${match.round.roundId}:${match.round.currentAnswerIndex}`;
}

function bumpGeneration(roomId: string): number {
  const next = (timerGenerationByRoomId.get(roomId) ?? 0) + 1;
  timerGenerationByRoomId.set(roomId, next);
  return next;
}

export function isWhoWroteItPhaseTimerPaused(roomId: string): boolean {
  return pausedRoomIds.has(roomId);
}

export function pauseWhoWroteItPhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);

  const match = getWhoWroteItState(roomId);

  if (match && TIMED_PHASES.has(match.round.gamePhase)) {
    pausedDeadlineRemainingMsByRoomId.set(
      roomId,
      remainingMsUntilDeadline(match.round.deadlineAtMs, match.round.phaseRemainingSeconds),
    );
  }

  stopWhoWroteItPhaseTimer(roomId);
}

export function resumeWhoWroteItPhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);

  const remainingMs = pausedDeadlineRemainingMsByRoomId.get(roomId);
  pausedDeadlineRemainingMsByRoomId.delete(roomId);

  const match = getWhoWroteItState(roomId);

  if (remainingMs !== undefined && match && TIMED_PHASES.has(match.round.gamePhase)) {
    setWhoWroteItState(
      roomId,
      withRound(match, {
        ...match.round,
        deadlineAtMs: Date.now() + remainingMs,
        phaseRemainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
      }),
    );
  }

  startWhoWroteItPhaseTimerIfNeeded(io, roomId);
}

export function stopWhoWroteItPhaseTimer(roomId: string): void {
  const timeoutId = timersByRoomId.get(roomId);

  if (timeoutId) {
    clearTimeout(timeoutId);
    timersByRoomId.delete(roomId);
  }
}

export function clearWhoWroteItPhaseTimerRuntime(roomId: string): void {
  stopWhoWroteItPhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
  pausedDeadlineRemainingMsByRoomId.delete(roomId);
  timerGenerationByRoomId.delete(roomId);
}

export function restartWhoWroteItPhaseTimer(io: Server, roomId: string): void {
  stopWhoWroteItPhaseTimer(roomId);
  bumpGeneration(roomId);
  startWhoWroteItPhaseTimerIfNeeded(io, roomId);
}

function handlePhaseTimerExpired(
  io: Server,
  roomId: string,
  match: WhoWroteItMatchState,
): void {
  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.phase !== 'PLAYING') {
    stopWhoWroteItPhaseTimer(roomId);
    return;
  }

  if (match.round.gamePhase === 'answering') {
    transitionToGuessing(io, roomId, match);
    return;
  }

  if (match.round.gamePhase === 'guessing') {
    const advanced = advanceGlobalAnswerOrComplete(match);

    if (advanced.completed) {
      startRoundResults(io, roomId, advanced.match);
      return;
    }

    setWhoWroteItState(roomId, advanced.match);
    restartWhoWroteItPhaseTimer(io, roomId);
    io.to(getRoomChannel(roomId)).emit(WHO_WROTE_IT_PHASE_CHANGED_EVENT, {});
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
  scheduledPhase: WhoWroteItMatchState['round']['gamePhase'],
  scheduledToken: string,
): void {
  if (timerGenerationByRoomId.get(roomId) !== generation) {
    return;
  }

  stopWhoWroteItPhaseTimer(roomId);

  const match = getWhoWroteItState(roomId);

  if (
    !match ||
    match.round.gamePhase !== scheduledPhase ||
    roundToken(match) !== scheduledToken
  ) {
    return;
  }

  handlePhaseTimerExpired(io, roomId, match);
}

export function startWhoWroteItPhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getWhoWroteItState(roomId);

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
