import type { Server } from 'socket.io';
import type { DrawGuessMatchState } from '@wanasatna/shared';
import { DRAW_GUESS_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import {
  advanceFromRoundResults,
  completeMatch,
  endDrawingRound,
} from './match-lifecycle.js';
import { getDrawGuessState, setDrawGuessState } from './store.js';
import { withRound } from './state.js';

const timersByRoomId = new Map<string, ReturnType<typeof setInterval>>();
const pausedRoomIds = new Set<string>();

const TIMED_TICK_PHASES = new Set<DrawGuessMatchState['round']['gamePhase']>([
  'drawing',
  'round-results',
  'match-completed',
]);

export function isDrawGuessPhaseTimerPaused(roomId: string): boolean {
  return pausedRoomIds.has(roomId);
}

export function pauseDrawGuessPhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);
  stopDrawGuessPhaseTimer(roomId);
}

export function resumeDrawGuessPhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);
  startDrawGuessPhaseTimerIfNeeded(io, roomId);
}

export function stopDrawGuessPhaseTimer(roomId: string): void {
  const intervalId = timersByRoomId.get(roomId);

  if (!intervalId) {
    return;
  }

  clearInterval(intervalId);
  timersByRoomId.delete(roomId);
}

export function clearDrawGuessPhaseTimerRuntime(roomId: string): void {
  stopDrawGuessPhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
}

export function restartDrawGuessPhaseTimer(io: Server, roomId: string): void {
  stopDrawGuessPhaseTimer(roomId);
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

export function startDrawGuessPhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getDrawGuessState(roomId);

  if (!match || !TIMED_TICK_PHASES.has(match.round.gamePhase)) {
    return;
  }

  if (match.round.phaseRemainingSeconds <= 0) {
    handlePhaseTimerExpired(io, roomId, match);
    return;
  }

  const intervalId = setInterval(() => {
    const currentMatch = getDrawGuessState(roomId);

    if (!currentMatch || !TIMED_TICK_PHASES.has(currentMatch.round.gamePhase)) {
      stopDrawGuessPhaseTimer(roomId);
      return;
    }

    const shell = getGameShellByRoomId(roomId);

    if (!shell || shell.phase !== 'PLAYING') {
      stopDrawGuessPhaseTimer(roomId);
      return;
    }

    const remainingSeconds = Math.max(0, currentMatch.round.phaseRemainingSeconds - 1);
    const nextMatch = withRound(currentMatch, {
      ...currentMatch.round,
      phaseRemainingSeconds: remainingSeconds,
    });

    setDrawGuessState(roomId, nextMatch);
    io.to(getRoomChannel(roomId)).emit(DRAW_GUESS_PHASE_CHANGED_EVENT, {});

    if (remainingSeconds <= 0) {
      handlePhaseTimerExpired(io, roomId, nextMatch);
    }
  }, 1000);

  timersByRoomId.set(roomId, intervalId);
}
