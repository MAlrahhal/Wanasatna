import type { Server } from 'socket.io';
import type { GuessingChallengeMatchState } from '@wanasatna/shared';
import { GUESSING_CHALLENGE_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import {
  advanceFromGuessingChallengeRoundResults,
  broadcastPhaseChanged,
  completeMatch,
} from './match-lifecycle.js';
import {
  expireGuessingChallengeTurn,
  remainingSecondsFromDeadline,
  withRound,
} from './state.js';
import { getGuessingChallengeState, setGuessingChallengeState } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setInterval>>();

const TIMED_PHASES = new Set<GuessingChallengeMatchState['round']['gamePhase']>([
  'playing',
  'round-results',
  'match-completed',
]);

export function pauseGuessingChallengePhaseTimer(roomId: string): void {
  // Guessing Challenge turn clocks intentionally continue during recovery.
  void roomId;
}

export function resumeGuessingChallengePhaseTimer(io: Server, roomId: string): void {
  startGuessingChallengePhaseTimerIfNeeded(io, roomId);
}

export function stopGuessingChallengePhaseTimer(roomId: string): void {
  const intervalId = timersByRoomId.get(roomId);

  if (intervalId) {
    clearInterval(intervalId);
    timersByRoomId.delete(roomId);
  }
}

export function clearGuessingChallengePhaseTimerRuntime(roomId: string): void {
  stopGuessingChallengePhaseTimer(roomId);
}

export function restartGuessingChallengePhaseTimer(io: Server, roomId: string): void {
  stopGuessingChallengePhaseTimer(roomId);
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

export function startGuessingChallengePhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (timersByRoomId.has(roomId)) {
    return;
  }

  const match = getGuessingChallengeState(roomId);

  if (!match || !TIMED_PHASES.has(match.round.gamePhase)) {
    return;
  }

  if (match.round.gamePhase === 'playing' && match.round.deadlineAtMs) {
    if (match.round.deadlineAtMs <= Date.now()) {
      handlePhaseTimerExpired(io, roomId, match);
      return;
    }
  } else if (match.round.phaseRemainingSeconds <= 0) {
    handlePhaseTimerExpired(io, roomId, match);
    return;
  }

  const intervalId = setInterval(() => {
    const currentMatch = getGuessingChallengeState(roomId);

    if (!currentMatch || !TIMED_PHASES.has(currentMatch.round.gamePhase)) {
      stopGuessingChallengePhaseTimer(roomId);
      return;
    }

    const shell = getGameShellByRoomId(roomId);

    if (!shell || shell.phase !== 'PLAYING') {
      stopGuessingChallengePhaseTimer(roomId);
      return;
    }

    if (
      currentMatch.round.gamePhase === 'playing' &&
      currentMatch.round.deadlineAtMs &&
      Date.now() >= currentMatch.round.deadlineAtMs
    ) {
      stopGuessingChallengePhaseTimer(roomId);
      handlePhaseTimerExpired(io, roomId, currentMatch);
      return;
    }

    const remainingSeconds =
      currentMatch.round.gamePhase === 'playing'
        ? remainingSecondsFromDeadline(currentMatch.round.deadlineAtMs)
        : Math.max(0, currentMatch.round.phaseRemainingSeconds - 1);
    const nextMatch = withRound(currentMatch, {
      ...currentMatch.round,
      phaseRemainingSeconds: remainingSeconds,
    });

    setGuessingChallengeState(roomId, nextMatch);
    io.to(getRoomChannel(roomId)).emit(GUESSING_CHALLENGE_PHASE_CHANGED_EVENT, {});

    if (
      remainingSeconds <= 0 &&
      (currentMatch.round.gamePhase === 'round-results' ||
        currentMatch.round.gamePhase === 'match-completed')
    ) {
      stopGuessingChallengePhaseTimer(roomId);
      handlePhaseTimerExpired(io, roomId, nextMatch);
    }
  }, 1000);

  timersByRoomId.set(roomId, intervalId);
}
