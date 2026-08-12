import type { Server } from 'socket.io';
import type { BaraAlSalafaMatchState } from '@wanasatna/shared';
import { BARA_AL_SALAFA_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { getBaraAlSalafaState, setBaraAlSalafaState } from './store.js';
import { withRound } from './round-state.js';

const timersByRoomId = new Map<string, ReturnType<typeof setInterval>>();
const timerGenerationByRoomId = new Map<string, number>();
const pausedRoomIds = new Set<string>();

type PhaseExpiredHandler = (
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
) => void;

let phaseExpiredHandler: PhaseExpiredHandler | null = null;

const TIMED_PHASES = new Set<BaraAlSalafaMatchState['round']['gamePhase']>([
  'description',
  'directed-questions',
  'free-questions',
  'voting',
  'reveal-impostor',
  'impostor-guess',
  'impostor-guess-result',
  'round-results',
  'match-completed',
]);

export function registerBaraPhaseExpiredHandler(handler: PhaseExpiredHandler): void {
  phaseExpiredHandler = handler;
}

export function isPhaseTimerPaused(roomId: string): boolean {
  return pausedRoomIds.has(roomId);
}

export function bumpPhaseTimerGeneration(roomId: string): number {
  const next = (timerGenerationByRoomId.get(roomId) ?? 0) + 1;
  timerGenerationByRoomId.set(roomId, next);
  return next;
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

export function clearPhaseTimerRuntime(roomId: string): void {
  stopPhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
  timerGenerationByRoomId.delete(roomId);
}

export function startPhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getBaraAlSalafaState(roomId);

  if (!match || !TIMED_PHASES.has(match.round.gamePhase)) {
    return;
  }

  const generation = timerGenerationByRoomId.get(roomId) ?? bumpPhaseTimerGeneration(roomId);

  const intervalId = setInterval(() => {
    if (timerGenerationByRoomId.get(roomId) !== generation) {
      clearInterval(intervalId);
      timersByRoomId.delete(roomId);
      return;
    }

    const currentMatch = getBaraAlSalafaState(roomId);

    if (!currentMatch || !TIMED_PHASES.has(currentMatch.round.gamePhase)) {
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
    io.to(getRoomChannel(roomId)).emit(BARA_AL_SALAFA_PHASE_CHANGED_EVENT, {});

    if (remainingSeconds <= 0) {
      stopPhaseTimer(roomId);
      phaseExpiredHandler?.(io, roomId, nextMatch);
    }
  }, 1000);

  timersByRoomId.set(roomId, intervalId);
}

/** Stop any running timer, bump generation, then start if the current phase is timed. */
export function restartPhaseTimer(io: Server, roomId: string): void {
  stopPhaseTimer(roomId);
  bumpPhaseTimerGeneration(roomId);
  startPhaseTimerIfNeeded(io, roomId);
}
