import type { Server } from 'socket.io';
import type { JudgeMatchState } from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import { remainingMsUntilDeadline } from '../../runtime/phase-deadline.js';
import {
  advanceFromRoundResults,
  completeMatch,
  startRoundResults,
  transitionToJudging,
} from './match-lifecycle.js';
import { isDeparted, withRound } from './state.js';
import { getJudgeState, setJudgeState } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setTimeout>>();
const timerGenerationByRoomId = new Map<string, number>();
const pausedRoomIds = new Set<string>();
const pausedDeadlineRemainingMsByRoomId = new Map<string, number>();

const TIMED_PHASES = new Set<JudgeMatchState['round']['gamePhase']>([
  'answering',
  'judging',
  'round-results',
  'match-completed',
]);

function roundToken(match: JudgeMatchState): string {
  return `${match.currentRound}:${match.round.gamePhase}:${match.round.roundId}`;
}

function bumpGeneration(roomId: string): number {
  const next = (timerGenerationByRoomId.get(roomId) ?? 0) + 1;
  timerGenerationByRoomId.set(roomId, next);
  return next;
}

export function pauseJudgePhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);

  const match = getJudgeState(roomId);

  if (match && TIMED_PHASES.has(match.round.gamePhase)) {
    pausedDeadlineRemainingMsByRoomId.set(
      roomId,
      remainingMsUntilDeadline(match.round.deadlineAtMs, match.round.phaseRemainingSeconds),
    );
  }

  stopJudgePhaseTimer(roomId);
}

export function resumeJudgePhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);

  const remainingMs = pausedDeadlineRemainingMsByRoomId.get(roomId);
  pausedDeadlineRemainingMsByRoomId.delete(roomId);

  const match = getJudgeState(roomId);

  if (remainingMs !== undefined && match && TIMED_PHASES.has(match.round.gamePhase)) {
    setJudgeState(
      roomId,
      withRound(match, {
        ...match.round,
        deadlineAtMs: Date.now() + remainingMs,
        phaseRemainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
      }),
    );
  }

  startJudgePhaseTimerIfNeeded(io, roomId);
}

export function stopJudgePhaseTimer(roomId: string): void {
  const timeoutId = timersByRoomId.get(roomId);

  if (timeoutId) {
    clearTimeout(timeoutId);
    timersByRoomId.delete(roomId);
  }
}

export function clearJudgePhaseTimerRuntime(roomId: string): void {
  stopJudgePhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
  pausedDeadlineRemainingMsByRoomId.delete(roomId);
  timerGenerationByRoomId.delete(roomId);
}

export function restartJudgePhaseTimer(io: Server, roomId: string): void {
  stopJudgePhaseTimer(roomId);
  bumpGeneration(roomId);
  startJudgePhaseTimerIfNeeded(io, roomId);
}

function handlePhaseTimerExpired(
  io: Server,
  roomId: string,
  match: JudgeMatchState,
): void {
  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.phase !== 'PLAYING') {
    stopJudgePhaseTimer(roomId);
    return;
  }

  if (
    match.round.gamePhase === 'judging' &&
    isDeparted(match, match.round.judgePlayerId) &&
    match.round.winningAnswerId === null
  ) {
    startRoundResults(io, roomId, match);
    return;
  }

  if (match.round.gamePhase === 'answering') {
    transitionToJudging(io, roomId, match);
    return;
  }

  if (match.round.gamePhase === 'judging') {
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
  scheduledPhase: JudgeMatchState['round']['gamePhase'],
  scheduledToken: string,
): void {
  if (timerGenerationByRoomId.get(roomId) !== generation) {
    return;
  }

  stopJudgePhaseTimer(roomId);

  const match = getJudgeState(roomId);

  if (
    !match ||
    match.round.gamePhase !== scheduledPhase ||
    roundToken(match) !== scheduledToken
  ) {
    return;
  }

  handlePhaseTimerExpired(io, roomId, match);
}

export function startJudgePhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getJudgeState(roomId);

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
