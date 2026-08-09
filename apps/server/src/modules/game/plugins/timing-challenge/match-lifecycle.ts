import type { Server } from 'socket.io';
import type { GameShellState, TimingChallengeMatchState } from '@wanasatna/shared';
import { TIMING_CHALLENGE_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { getRoomChannel } from '../../../room/room.utils.js';
import { finishGameShellForRoom } from '../../game.service.js';
import { cleanupGameShellRuntime } from '../../game.lifecycle.js';
import { broadcastGameShellState } from '../../game.timer.js';
import {
  startTimingChallengePhaseTimerIfNeeded,
  stopTimingChallengePhaseTimer,
} from './phase-timer.js';
import { applyRoundScores } from './scoring.js';
import { createRoundState, withRound } from './state.js';
import { deleteTimingChallengeState, setTimingChallengeState } from './store.js';

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
    hiddenStartedAtMs: now,
    hiddenEndsAtMs: now + match.round.targetMs,
  });

  setTimingChallengeState(roomId, nextMatch);
  startTimingChallengePhaseTimerIfNeeded(io, roomId);
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
    phaseRemainingSeconds: 0,
    hiddenEndsAtMs: match.round.hiddenEndsAtMs ?? Date.now(),
  });

  setTimingChallengeState(roomId, nextMatch);
  stopTimingChallengePhaseTimer(roomId);
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
    phaseRemainingSeconds: 0,
  });

  setTimingChallengeState(roomId, nextMatch);
  stopTimingChallengePhaseTimer(roomId);
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
    phaseRemainingSeconds: 0,
  });

  setTimingChallengeState(roomId, nextMatch);
  stopTimingChallengePhaseTimer(roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

function startNextRound(
  io: Server,
  roomId: string,
  match: TimingChallengeMatchState,
): TimingChallengeMatchState {
  const nextRoundNumber = match.currentRound + 1;
  const nextMatch: TimingChallengeMatchState = {
    ...match,
    currentRound: nextRoundNumber,
    matchStatus: 'in-progress',
    round: createRoundState(match.playerIds, match.settings),
  };

  setTimingChallengeState(roomId, nextMatch);
  stopTimingChallengePhaseTimer(roomId);
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
      phaseRemainingSeconds: timedPhaseDurations.matchResults(),
    },
  );

  setTimingChallengeState(roomId, nextMatch);
  startTimingChallengePhaseTimerIfNeeded(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function continueFromRoundResults(
  io: Server,
  roomId: string,
  match: TimingChallengeMatchState,
  shell: GameShellState,
  hostPlayerId: string,
): TimingChallengeMatchState {
  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  if (shell.hostPlayerId !== hostPlayerId) {
    return match;
  }

  stopTimingChallengePhaseTimer(roomId);

  if (match.currentRound < match.totalRounds) {
    return startNextRound(io, roomId, match);
  }

  return startMatchCompletedPhase(io, roomId, match);
}

export function completeMatch(io: Server, roomId: string): void {
  stopTimingChallengePhaseTimer(roomId);
  deleteTimingChallengeState(roomId);

  const nextShell = finishGameShellForRoom(roomId);

  if (nextShell) {
    cleanupGameShellRuntime(roomId);
    broadcastGameShellState(io, nextShell);
  }
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
