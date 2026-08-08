import type { Server } from 'socket.io';
import type { DrawGuessMatchState } from '@wanasatna/shared';
import { DRAW_GUESS_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { completeMatch, endDrawingRound } from './match-lifecycle.js';
import { getDrawGuessState, setDrawGuessState } from './store.js';
import { withRound } from './state.js';

const timersByRoomId = new Map<string, ReturnType<typeof setInterval>>();
const pausedRoomIds = new Set<string>();

const TIMERLESS_PHASES = new Set<DrawGuessMatchState['round']['gamePhase']>([
  'round-results',
]);

const TIMED_TICK_PHASES = new Set<DrawGuessMatchState['round']['gamePhase']>([
  'drawing',
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

function handlePhaseTimerExpired(
  io: Server,
  roomId: string,
  match: DrawGuessMatchState,
): void {
  if (match.round.gamePhase === 'drawing') {
    endDrawingRound(io, roomId, match, {
      guessedCorrectly: false,
      correctGuesserPlayerId: null,
    });
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

  if (!match || TIMERLESS_PHASES.has(match.round.gamePhase)) {
    return;
  }

  if (match.round.phaseRemainingSeconds <= 0 && match.round.gamePhase === 'drawing') {
    handlePhaseTimerExpired(io, roomId, match);
    return;
  }

  const intervalId = setInterval(() => {
    const currentMatch = getDrawGuessState(roomId);

    if (!currentMatch || TIMERLESS_PHASES.has(currentMatch.round.gamePhase)) {
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

    if (TIMED_TICK_PHASES.has(currentMatch.round.gamePhase)) {
      io.to(getRoomChannel(roomId)).emit(DRAW_GUESS_PHASE_CHANGED_EVENT, {});
    }

    if (remainingSeconds <= 0) {
      handlePhaseTimerExpired(io, roomId, nextMatch);
    }
  }, 1000);

  timersByRoomId.set(roomId, intervalId);
}
