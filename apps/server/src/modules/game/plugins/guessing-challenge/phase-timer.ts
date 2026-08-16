import type { Server } from 'socket.io';
import type { GuessingChallengeMatchState } from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import { remainingMsUntilDeadline } from '../../runtime/phase-deadline.js';
import {
  advanceFromGuessingChallengeRoundResults,
  broadcastPhaseChanged,
  completeMatch,
} from './match-lifecycle.js';
import { expireGuessingChallengeTurn } from './state.js';
import { getGuessingChallengeState, setGuessingChallengeState } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setTimeout>>();
const timerGenerationByRoomId = new Map<string, number>();

const TIMED_PHASES = new Set<GuessingChallengeMatchState['round']['gamePhase']>([
  'playing',
  'round-results',
  'match-completed',
]);

function roundToken(match: GuessingChallengeMatchState): string {
  return `${match.round.roundId}:${match.round.turnId}:${match.round.gamePhase}`;
}

function bumpGeneration(roomId: string): number {
  const next = (timerGenerationByRoomId.get(roomId) ?? 0) + 1;
  timerGenerationByRoomId.set(roomId, next);
  return next;
}

export function pauseGuessingChallengePhaseTimer(roomId: string): void {
  // Guessing Challenge turn clocks intentionally continue during recovery.
  void roomId;
}

export function resumeGuessingChallengePhaseTimer(io: Server, roomId: string): void {
  startGuessingChallengePhaseTimerIfNeeded(io, roomId);
}

export function stopGuessingChallengePhaseTimer(roomId: string): void {
  const timeoutId = timersByRoomId.get(roomId);

  if (timeoutId) {
    clearTimeout(timeoutId);
    timersByRoomId.delete(roomId);
  }
}

export function clearGuessingChallengePhaseTimerRuntime(roomId: string): void {
  stopGuessingChallengePhaseTimer(roomId);
  timerGenerationByRoomId.delete(roomId);
}

export function restartGuessingChallengePhaseTimer(io: Server, roomId: string): void {
  stopGuessingChallengePhaseTimer(roomId);
  bumpGeneration(roomId);
  startGuessingChallengePhaseTimerIfNeeded(io, roomId);
}

function handlePhaseTimerExpired(
  io: Server,
  roomId: string,
  match: GuessingChallengeMatchState,
): void {
  const shell = getGameShellByRoomId(roomId);
  if (!shell || shell.phase !== 'PLAYING') {
    stopGuessingChallengePhaseTimer(roomId);
    return;
  }

  if (match.round.gamePhase === 'playing') {
    const advanced = expireGuessingChallengeTurn(
      match,
      match.round.roundId,
      match.round.turnId,
    );
    if (!advanced) {
      return;
    }
    setGuessingChallengeState(roomId, advanced);
    restartGuessingChallengePhaseTimer(io, roomId);
    broadcastPhaseChanged(io, roomId);
    return;
  }

  if (match.round.gamePhase === 'round-results') {
    advanceFromGuessingChallengeRoundResults(io, roomId, match);
    return;
  }

  completeMatch(io, roomId);
}

function firePhaseExpiry(
  io: Server,
  roomId: string,
  generation: number,
  scheduledPhase: GuessingChallengeMatchState['round']['gamePhase'],
  scheduledToken: string,
): void {
  if (timerGenerationByRoomId.get(roomId) !== generation) {
    return;
  }

  stopGuessingChallengePhaseTimer(roomId);

  const match = getGuessingChallengeState(roomId);

  if (
    !match ||
    match.round.gamePhase !== scheduledPhase ||
    roundToken(match) !== scheduledToken
  ) {
    return;
  }

  handlePhaseTimerExpired(io, roomId, match);
}

export function startGuessingChallengePhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (timersByRoomId.has(roomId)) {
    return;
  }

  const match = getGuessingChallengeState(roomId);

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
