import type { Server } from 'socket.io';
import type { FastAnswerMatchState } from '@wanasatna/shared';
import { FAST_ANSWER_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { completeMatch, finalizeQuestionRound } from './match-lifecycle.js';
import { remainingSecondsFromDeadline, withRound } from './state.js';
import { getFastAnswerState, setFastAnswerState } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setInterval>>();
const pausedRoomIds = new Set<string>();
const pausedQuestionRemainingMsByRoomId = new Map<string, number>();

const TIMERLESS_PHASES = new Set<FastAnswerMatchState['round']['gamePhase']>([
  'round-results',
]);

const TIMED_TICK_PHASES = new Set<FastAnswerMatchState['round']['gamePhase']>([
  'question',
  'match-completed',
]);

export function isFastAnswerPhaseTimerPaused(roomId: string): boolean {
  return pausedRoomIds.has(roomId);
}

export function pauseFastAnswerPhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);

  const match = getFastAnswerState(roomId);

  if (match?.round.gamePhase === 'question' && match.round.deadlineAtMs) {
    pausedQuestionRemainingMsByRoomId.set(
      roomId,
      Math.max(0, match.round.deadlineAtMs - Date.now()),
    );
  }

  stopFastAnswerPhaseTimer(roomId);
}

export function resumeFastAnswerPhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);

  const remainingMs = pausedQuestionRemainingMsByRoomId.get(roomId);
  pausedQuestionRemainingMsByRoomId.delete(roomId);

  const match = getFastAnswerState(roomId);

  if (remainingMs !== undefined && match?.round.gamePhase === 'question') {
    setFastAnswerState(
      roomId,
      withRound(match, {
        ...match.round,
        deadlineAtMs: Date.now() + remainingMs,
        phaseRemainingSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
      }),
    );
  }

  startFastAnswerPhaseTimerIfNeeded(io, roomId);
}

export function stopFastAnswerPhaseTimer(roomId: string): void {
  const intervalId = timersByRoomId.get(roomId);

  if (intervalId) {
    clearInterval(intervalId);
    timersByRoomId.delete(roomId);
  }
}

export function clearFastAnswerPhaseTimerRuntime(roomId: string): void {
  stopFastAnswerPhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
  pausedQuestionRemainingMsByRoomId.delete(roomId);
}

function handlePhaseTimerExpired(
  io: Server,
  roomId: string,
  match: FastAnswerMatchState,
): void {
  if (match.round.gamePhase === 'question') {
    finalizeQuestionRound(io, roomId, match, {
      winnerPlayerId: match.round.winnerPlayerId,
      timedOut: match.round.winnerPlayerId === null,
    });
    return;
  }

  if (match.round.gamePhase === 'match-completed') {
    completeMatch(io, roomId);
  }
}

export function startFastAnswerPhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getFastAnswerState(roomId);

  if (!match || TIMERLESS_PHASES.has(match.round.gamePhase)) {
    return;
  }

  if (match.round.gamePhase === 'question' && match.round.deadlineAtMs) {
    const remainingMs = match.round.deadlineAtMs - Date.now();

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
    const currentMatch = getFastAnswerState(roomId);

    if (!currentMatch || TIMERLESS_PHASES.has(currentMatch.round.gamePhase)) {
      stopFastAnswerPhaseTimer(roomId);
      return;
    }

    const shell = getGameShellByRoomId(roomId);

    if (!shell || shell.phase !== 'PLAYING') {
      stopFastAnswerPhaseTimer(roomId);
      return;
    }

    if (
      currentMatch.round.gamePhase === 'question' &&
      currentMatch.round.deadlineAtMs &&
      Date.now() >= currentMatch.round.deadlineAtMs
    ) {
      stopFastAnswerPhaseTimer(roomId);
      handlePhaseTimerExpired(io, roomId, currentMatch);
      return;
    }

    const remainingSeconds =
      currentMatch.round.gamePhase === 'question'
        ? remainingSecondsFromDeadline(currentMatch.round.deadlineAtMs)
        : Math.max(0, currentMatch.round.phaseRemainingSeconds - 1);

    const nextMatch = withRound(currentMatch, {
      ...currentMatch.round,
      phaseRemainingSeconds: remainingSeconds,
    });

    setFastAnswerState(roomId, nextMatch);

    if (TIMED_TICK_PHASES.has(currentMatch.round.gamePhase)) {
      io.to(getRoomChannel(roomId)).emit(FAST_ANSWER_PHASE_CHANGED_EVENT, {});
    }

    if (remainingSeconds <= 0 && currentMatch.round.gamePhase === 'match-completed') {
      handlePhaseTimerExpired(io, roomId, nextMatch);
    }
  }, 1000);

  timersByRoomId.set(roomId, intervalId);
}
