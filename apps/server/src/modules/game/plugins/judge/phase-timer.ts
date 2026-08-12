import type { Server } from 'socket.io';
import type { JudgeMatchState } from '@wanasatna/shared';
import { JUDGE_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import {
  advanceFromRoundResults,
  completeMatch,
  startRoundResults,
  transitionToJudging,
} from './match-lifecycle.js';
import { isDeparted, remainingSecondsFromDeadline, withRound } from './state.js';
import { getJudgeState, setJudgeState } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setInterval>>();
const pausedRoomIds = new Set<string>();
const pausedDeadlineRemainingMsByRoomId = new Map<string, number>();

const TIMED_PHASES = new Set<JudgeMatchState['round']['gamePhase']>([
  'answering',
  'judging',
  'round-results',
  'match-completed',
]);

const DEADLINE_PHASES = new Set<JudgeMatchState['round']['gamePhase']>([
  'answering',
  'judging',
]);

export function pauseJudgePhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);

  const match = getJudgeState(roomId);

  if (match && DEADLINE_PHASES.has(match.round.gamePhase) && match.round.deadlineAtMs) {
    pausedDeadlineRemainingMsByRoomId.set(
      roomId,
      Math.max(0, match.round.deadlineAtMs - Date.now()),
    );
  }

  stopJudgePhaseTimer(roomId);
}

export function resumeJudgePhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);

  const remainingMs = pausedDeadlineRemainingMsByRoomId.get(roomId);
  pausedDeadlineRemainingMsByRoomId.delete(roomId);

  const match = getJudgeState(roomId);

  if (remainingMs !== undefined && match && DEADLINE_PHASES.has(match.round.gamePhase)) {
    setJudgeState(
      roomId,
      withRound(match, {
        ...match.round,
        deadlineAtMs: Date.now() + remainingMs,
        phaseRemainingSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
      }),
    );
  }

  startJudgePhaseTimerIfNeeded(io, roomId);
}

export function stopJudgePhaseTimer(roomId: string): void {
  const intervalId = timersByRoomId.get(roomId);

  if (intervalId) {
    clearInterval(intervalId);
    timersByRoomId.delete(roomId);
  }
}

export function clearJudgePhaseTimerRuntime(roomId: string): void {
  stopJudgePhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
  pausedDeadlineRemainingMsByRoomId.delete(roomId);
}

export function restartJudgePhaseTimer(io: Server, roomId: string): void {
  stopJudgePhaseTimer(roomId);
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

export function startJudgePhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getJudgeState(roomId);

  if (!match || !TIMED_PHASES.has(match.round.gamePhase)) {
    return;
  }

  if (DEADLINE_PHASES.has(match.round.gamePhase) && match.round.deadlineAtMs) {
    if (match.round.deadlineAtMs - Date.now() <= 0) {
      handlePhaseTimerExpired(io, roomId, match);
      return;
    }
  } else if (match.round.phaseRemainingSeconds <= 0) {
    handlePhaseTimerExpired(io, roomId, match);
    return;
  }

  const intervalId = setInterval(() => {
    const currentMatch = getJudgeState(roomId);

    if (!currentMatch || !TIMED_PHASES.has(currentMatch.round.gamePhase)) {
      stopJudgePhaseTimer(roomId);
      return;
    }

    const shell = getGameShellByRoomId(roomId);

    if (!shell || shell.phase !== 'PLAYING') {
      stopJudgePhaseTimer(roomId);
      return;
    }

    if (
      currentMatch.round.gamePhase === 'judging' &&
      isDeparted(currentMatch, currentMatch.round.judgePlayerId) &&
      currentMatch.round.winningAnswerId === null
    ) {
      stopJudgePhaseTimer(roomId);
      startRoundResults(io, roomId, currentMatch);
      return;
    }

    if (
      DEADLINE_PHASES.has(currentMatch.round.gamePhase) &&
      currentMatch.round.deadlineAtMs &&
      Date.now() >= currentMatch.round.deadlineAtMs
    ) {
      stopJudgePhaseTimer(roomId);
      handlePhaseTimerExpired(io, roomId, currentMatch);
      return;
    }

    const remainingSeconds = DEADLINE_PHASES.has(currentMatch.round.gamePhase)
      ? remainingSecondsFromDeadline(currentMatch.round.deadlineAtMs)
      : Math.max(0, currentMatch.round.phaseRemainingSeconds - 1);

    const nextMatch = withRound(currentMatch, {
      ...currentMatch.round,
      phaseRemainingSeconds: remainingSeconds,
    });

    setJudgeState(roomId, nextMatch);
    io.to(getRoomChannel(roomId)).emit(JUDGE_PHASE_CHANGED_EVENT, {});

    if (
      remainingSeconds <= 0 &&
      (currentMatch.round.gamePhase === 'round-results' ||
        currentMatch.round.gamePhase === 'match-completed')
    ) {
      stopJudgePhaseTimer(roomId);
      handlePhaseTimerExpired(io, roomId, nextMatch);
    }
  }, 1000);

  timersByRoomId.set(roomId, intervalId);
}
