import type { Server } from 'socket.io';
import type { WhoWroteItMatchState } from '@wanasatna/shared';
import { WHO_WROTE_IT_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import {
  advanceFromRoundResults,
  completeMatch,
  startRoundResults,
  transitionToGuessing,
} from './match-lifecycle.js';
import {
  advanceGlobalAnswerOrComplete,
  remainingSecondsFromDeadline,
  withRound,
} from './state.js';
import { getWhoWroteItState, setWhoWroteItState } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setInterval>>();
const pausedRoomIds = new Set<string>();
const pausedDeadlineRemainingMsByRoomId = new Map<string, number>();

const TIMED_PHASES = new Set<WhoWroteItMatchState['round']['gamePhase']>([
  'answering',
  'guessing',
  'round-results',
  'match-completed',
]);

const DEADLINE_PHASES = new Set<WhoWroteItMatchState['round']['gamePhase']>([
  'answering',
  'guessing',
]);

export function isWhoWroteItPhaseTimerPaused(roomId: string): boolean {
  return pausedRoomIds.has(roomId);
}

export function pauseWhoWroteItPhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);

  const match = getWhoWroteItState(roomId);

  if (match && DEADLINE_PHASES.has(match.round.gamePhase) && match.round.deadlineAtMs) {
    pausedDeadlineRemainingMsByRoomId.set(
      roomId,
      Math.max(0, match.round.deadlineAtMs - Date.now()),
    );
  }

  stopWhoWroteItPhaseTimer(roomId);
}

export function resumeWhoWroteItPhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);

  const remainingMs = pausedDeadlineRemainingMsByRoomId.get(roomId);
  pausedDeadlineRemainingMsByRoomId.delete(roomId);

  const match = getWhoWroteItState(roomId);

  if (remainingMs !== undefined && match && DEADLINE_PHASES.has(match.round.gamePhase)) {
    setWhoWroteItState(
      roomId,
      withRound(match, {
        ...match.round,
        deadlineAtMs: Date.now() + remainingMs,
        phaseRemainingSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
      }),
    );
  }

  startWhoWroteItPhaseTimerIfNeeded(io, roomId);
}

export function stopWhoWroteItPhaseTimer(roomId: string): void {
  const intervalId = timersByRoomId.get(roomId);

  if (intervalId) {
    clearInterval(intervalId);
    timersByRoomId.delete(roomId);
  }
}

export function clearWhoWroteItPhaseTimerRuntime(roomId: string): void {
  stopWhoWroteItPhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
  pausedDeadlineRemainingMsByRoomId.delete(roomId);
}

export function restartWhoWroteItPhaseTimer(io: Server, roomId: string): void {
  stopWhoWroteItPhaseTimer(roomId);
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

export function startWhoWroteItPhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getWhoWroteItState(roomId);

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
    const currentMatch = getWhoWroteItState(roomId);

    if (!currentMatch || !TIMED_PHASES.has(currentMatch.round.gamePhase)) {
      stopWhoWroteItPhaseTimer(roomId);
      return;
    }

    const shell = getGameShellByRoomId(roomId);

    if (!shell || shell.phase !== 'PLAYING') {
      stopWhoWroteItPhaseTimer(roomId);
      return;
    }

    if (
      DEADLINE_PHASES.has(currentMatch.round.gamePhase) &&
      currentMatch.round.deadlineAtMs &&
      Date.now() >= currentMatch.round.deadlineAtMs
    ) {
      stopWhoWroteItPhaseTimer(roomId);
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

    setWhoWroteItState(roomId, nextMatch);
    io.to(getRoomChannel(roomId)).emit(WHO_WROTE_IT_PHASE_CHANGED_EVENT, {});

    if (
      remainingSeconds <= 0 &&
      (currentMatch.round.gamePhase === 'round-results' ||
        currentMatch.round.gamePhase === 'match-completed')
    ) {
      stopWhoWroteItPhaseTimer(roomId);
      handlePhaseTimerExpired(io, roomId, nextMatch);
    }
  }, 1000);

  timersByRoomId.set(roomId, intervalId);
}
