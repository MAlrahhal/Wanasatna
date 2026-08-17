import type { Server } from 'socket.io';
import type { GameShellState, TimingChallengeMatchState } from '@wanasatna/shared';
import { TIMING_CHALLENGE_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { timedPhaseClock } from '../../runtime/phase-deadline.js';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { persistCompletedMatchThen } from '../../runtime/persist-completed-match.js';
import { teardownShellAndReturnToLobby } from '../../game.lifecycle.js';
import {
  clearTimingChallengePhaseTimerRuntime,
  restartTimingChallengePhaseTimer,
  stopTimingChallengePhaseTimer,
} from './phase-timer.js';
import { applyRoundScores } from './scoring.js';
import { createRoundState, withRound } from './state.js';
import {
  clearTimingChallengeSettings,
  deleteTimingChallengeState,
  setTimingChallengeState,
} from './store.js';

function broadcastPhaseChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(TIMING_CHALLENGE_PHASE_CHANGED_EVENT, {});
}

export function startHiddenTimingPhase(
  io: Server,
  roomId: string,
  match: TimingChallengeMatchState,
): TimingChallengeMatchState {
  const now = Date.now();
  const nextMatch = withRound(match, {
    ...match.round,
    gamePhase: 'hidden-timing',
    phaseRemainingSeconds: Math.max(1, Math.ceil(match.round.targetMs / 1000)),
    deadlineAtMs: null,
    hiddenStartedAtMs: now,
    hiddenEndsAtMs: now + match.round.targetMs,
  });

  setTimingChallengeState(roomId, nextMatch);
  restartTimingChallengePhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function startGuessingPhase(
  io: Server,
  roomId: string,
  match: TimingChallengeMatchState,
): TimingChallengeMatchState {
  const nextMatch = withRound(match, {
    ...match.round,
    gamePhase: 'guessing',
    ...timedPhaseClock(timedPhaseDurations.timingChallengeGuess()),
    hiddenEndsAtMs: match.round.hiddenEndsAtMs ?? Date.now(),
  });

  setTimingChallengeState(roomId, nextMatch);
  restartTimingChallengePhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function startStopTimerPhase(
  io: Server,
  roomId: string,
  match: TimingChallengeMatchState,
): TimingChallengeMatchState {
  const nextMatch = withRound(match, {
    ...match.round,
    gamePhase: 'stop-timer',
    ...timedPhaseClock(timedPhaseDurations.timingChallengeStopPhase()),
  });

  setTimingChallengeState(roomId, nextMatch);
  restartTimingChallengePhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function startRoundResults(
  io: Server,
  roomId: string,
  match: TimingChallengeMatchState,
): TimingChallengeMatchState {
  if (match.round.gamePhase === 'round-results' || match.round.gamePhase === 'match-completed') {
    return match;
  }

  const scoredMatch = applyRoundScores(match);
  const nextMatch = withRound(scoredMatch, {
    ...scoredMatch.round,
    gamePhase: 'round-results',
    ...timedPhaseClock(timedPhaseDurations.timingChallengeRoundResults()),
  });

  setTimingChallengeState(roomId, nextMatch);
  restartTimingChallengePhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

function startNextRound(
  io: Server,
  roomId: string,
  match: TimingChallengeMatchState,
): TimingChallengeMatchState {
  const nextMatch: TimingChallengeMatchState = {
    ...match,
    currentRound: match.currentRound + 1,
    matchStatus: 'in-progress',
    round: createRoundState(match.playerIds, match.settings),
  };

  setTimingChallengeState(roomId, nextMatch);
  restartTimingChallengePhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

function startMatchCompletedPhase(
  io: Server,
  roomId: string,
  match: TimingChallengeMatchState,
): TimingChallengeMatchState {
  const nextMatch = withRound(
    {
      ...match,
      matchStatus: 'completed',
    },
    {
      ...match.round,
      gamePhase: 'match-completed',
      ...timedPhaseClock(timedPhaseDurations.matchResults()),
    },
  );

  setTimingChallengeState(roomId, nextMatch);
  restartTimingChallengePhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function advanceFromRoundResults(
  io: Server,
  roomId: string,
  match: TimingChallengeMatchState,
): TimingChallengeMatchState {
  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  stopTimingChallengePhaseTimer(roomId);

  if (match.currentRound < match.totalRounds) {
    return startNextRound(io, roomId, match);
  }

  return startMatchCompletedPhase(io, roomId, match);
}

export function continueFromRoundResults(
  io: Server,
  roomId: string,
  match: TimingChallengeMatchState,
  shell: GameShellState,
  hostPlayerId: string,
): TimingChallengeMatchState {
  if (shell.hostPlayerId !== hostPlayerId) {
    return match;
  }

  if (match.round.gamePhase === 'match-completed') {
    completeMatch(io, roomId);
    return match;
  }

  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  return advanceFromRoundResults(io, roomId, match);
}

export function completeMatch(io: Server, roomId: string): void {
  persistCompletedMatchThen(roomId, () => {
    clearTimingChallengePhaseTimerRuntime(roomId);
    deleteTimingChallengeState(roomId);
    clearTimingChallengeSettings(roomId);

    const shell = getGameShellByRoomId(roomId);
    if (!shell) {
      return;
    }

    teardownShellAndReturnToLobby(io, roomId);
  });
}

export function advanceFromReady(
  io: Server,
  roomId: string,
  match: TimingChallengeMatchState,
): TimingChallengeMatchState {
  if (match.settings.mode === 'guess-time') {
    return startHiddenTimingPhase(io, roomId, match);
  }

  return startStopTimerPhase(io, roomId, match);
}
