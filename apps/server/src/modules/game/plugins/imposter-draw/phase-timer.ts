import type { Server } from 'socket.io';
import type { ImposterDrawMatchState } from '@wanasatna/shared';
import { IMPOSTER_DRAW_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import {
  advanceDrawingTurn,
  completeMatch,
  completeRevealPhase,
} from './match-lifecycle.js';
import { getImposterDrawState, setImposterDrawState } from './store.js';
import { withRound } from './state.js';

const timersByRoomId = new Map<string, ReturnType<typeof setInterval>>();
const pausedRoomIds = new Set<string>();

const TIMERLESS_PHASES = new Set<ImposterDrawMatchState['round']['gamePhase']>([
  'voting',
  'impostor-guess',
  'round-results',
]);

const TIMED_TICK_PHASES = new Set<ImposterDrawMatchState['round']['gamePhase']>([
  'drawing-turns',
  'reveal',
  'match-completed',
]);

export function isImposterDrawPhaseTimerPaused(roomId: string): boolean {
  return pausedRoomIds.has(roomId);
}

export function pauseImposterDrawPhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);
  stopImposterDrawPhaseTimer(roomId);
}

export function resumeImposterDrawPhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);
  startImposterDrawPhaseTimerIfNeeded(io, roomId);
}

export function stopImposterDrawPhaseTimer(roomId: string): void {
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
  match: ImposterDrawMatchState,
): void {
  if (match.round.gamePhase === 'drawing-turns') {
    advanceDrawingTurn(io, roomId, match);
    return;
  }

  if (match.round.gamePhase === 'reveal') {
    completeRevealPhase(io, roomId, match);
    return;
  }

  if (match.round.gamePhase === 'match-completed') {
    completeMatch(io, roomId);
  }
}

export function startImposterDrawPhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getImposterDrawState(roomId);

  if (!match || TIMERLESS_PHASES.has(match.round.gamePhase)) {
    return;
  }

  if (match.round.phaseRemainingSeconds <= 0 && TIMED_TICK_PHASES.has(match.round.gamePhase)) {
    handlePhaseTimerExpired(io, roomId, match);
    return;
  }

  const intervalId = setInterval(() => {
    const currentMatch = getImposterDrawState(roomId);

    if (!currentMatch || TIMERLESS_PHASES.has(currentMatch.round.gamePhase)) {
      stopImposterDrawPhaseTimer(roomId);
      return;
    }

    const shell = getGameShellByRoomId(roomId);

    if (!shell || shell.phase !== 'PLAYING') {
      stopImposterDrawPhaseTimer(roomId);
      return;
    }

    const remainingSeconds = Math.max(0, currentMatch.round.phaseRemainingSeconds - 1);
    const nextMatch = withRound(currentMatch, {
      ...currentMatch.round,
      phaseRemainingSeconds: remainingSeconds,
    });

    setImposterDrawState(roomId, nextMatch);

    if (TIMED_TICK_PHASES.has(currentMatch.round.gamePhase)) {
      io.to(getRoomChannel(roomId)).emit(IMPOSTER_DRAW_PHASE_CHANGED_EVENT, {});
    }

    if (remainingSeconds <= 0) {
      handlePhaseTimerExpired(io, roomId, nextMatch);
    }
  }, 1000);

  timersByRoomId.set(roomId, intervalId);
}
