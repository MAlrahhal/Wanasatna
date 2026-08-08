import type { Server } from 'socket.io';
import type { BaraAlSalafaMatchState } from '@wanasatna/shared';
import { BARA_AL_SALAFA_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { completeDescriptionPhase, completeRevealImpostorPhase } from './phase-flow.js';
import { completeMatchCompletedPhase } from './match-lifecycle.js';
import { getBaraAlSalafaState, setBaraAlSalafaState } from './store.js';
import { withRound } from './round-state.js';

const timersByRoomId = new Map<string, ReturnType<typeof setInterval>>();
const pausedRoomIds = new Set<string>();

const TIMERLESS_PHASES = new Set<BaraAlSalafaMatchState['round']['gamePhase']>([
  'directed-questions',
  'free-questions',
  'voting',
  'impostor-guess',
  'round-results',
]);

const TIMED_TICK_PHASES = new Set<BaraAlSalafaMatchState['round']['gamePhase']>([
  'description',
  'reveal-impostor',
  'match-completed',
]);

export function isPhaseTimerPaused(roomId: string): boolean {
  return pausedRoomIds.has(roomId);
}

export function pausePhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);
  stopPhaseTimer(roomId);
}

export function resumePhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);
  startPhaseTimerIfNeeded(io, roomId);
}

export function stopPhaseTimer(roomId: string): void {
  const intervalId = timersByRoomId.get(roomId);

  if (!intervalId) {
    return;
  }

  clearInterval(intervalId);
  timersByRoomId.delete(roomId);
}

function handlePhaseTimerExpired(io: Server, roomId: string, match: BaraAlSalafaMatchState): void {
  if (match.round.gamePhase === 'description') {
    completeDescriptionPhase(io, roomId, match);
    return;
  }

  if (match.round.gamePhase === 'reveal-impostor') {
    completeRevealImpostorPhase(io, roomId, match);
    return;
  }

  if (match.round.gamePhase === 'match-completed') {
    completeMatchCompletedPhase(io, roomId);
  }
}

export function startPhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getBaraAlSalafaState(roomId);

  if (!match || TIMERLESS_PHASES.has(match.round.gamePhase)) {
    return;
  }

  const intervalId = setInterval(() => {
    const currentMatch = getBaraAlSalafaState(roomId);

    if (!currentMatch || TIMERLESS_PHASES.has(currentMatch.round.gamePhase)) {
      stopPhaseTimer(roomId);
      return;
    }

    const shell = getGameShellByRoomId(roomId);

    if (!shell || shell.phase !== 'PLAYING') {
      stopPhaseTimer(roomId);
      return;
    }

    const remainingSeconds = Math.max(0, currentMatch.round.phaseRemainingSeconds - 1);
    const nextMatch = withRound(currentMatch, {
      ...currentMatch.round,
      phaseRemainingSeconds: remainingSeconds,
    });

    setBaraAlSalafaState(roomId, nextMatch);

    if (TIMED_TICK_PHASES.has(currentMatch.round.gamePhase)) {
      io.to(getRoomChannel(roomId)).emit(BARA_AL_SALAFA_PHASE_CHANGED_EVENT, {});
    }

    if (remainingSeconds <= 0) {
      handlePhaseTimerExpired(io, roomId, nextMatch);
    }
  }, 1000);

  timersByRoomId.set(roomId, intervalId);
}
