import type { Server } from 'socket.io';
import type { ImposterDrawMatchState } from '@wanasatna/shared';
import { IMPOSTER_DRAW_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
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
import { getImposterDrawState, setImposterDrawState } from './store.js';
import { withRound } from './state.js';

const timersByRoomId = new Map<string, ReturnType<typeof setInterval>>();
const pausedRoomIds = new Set<string>();

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

export function clearImposterDrawPhaseTimerRuntime(roomId: string): void {
  stopImposterDrawPhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
}

export function restartImposterDrawPhaseTimer(io: Server, roomId: string): void {
  stopImposterDrawPhaseTimer(roomId);
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

export function startImposterDrawPhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getImposterDrawState(roomId);

  if (!match || !TIMED_PHASES.has(match.round.gamePhase)) {
    return;
  }

  if (match.round.phaseRemainingSeconds <= 0) {
    handlePhaseTimerExpired(io, roomId, match);
    return;
  }

  const intervalId = setInterval(() => {
    const currentMatch = getImposterDrawState(roomId);

    if (!currentMatch || !TIMED_PHASES.has(currentMatch.round.gamePhase)) {
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
    io.to(getRoomChannel(roomId)).emit(IMPOSTER_DRAW_PHASE_CHANGED_EVENT, {});

    if (remainingSeconds <= 0) {
      handlePhaseTimerExpired(io, roomId, nextMatch);
    }
  }, 1000);

  timersByRoomId.set(roomId, intervalId);
}
