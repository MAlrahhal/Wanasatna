import type { Server } from 'socket.io';
import type { GameShellState, GuessingChallengeMatchState } from '@wanasatna/shared';
import { GUESSING_CHALLENGE_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { getRoomChannel } from '../../../room/room.utils.js';
import { finishGameShellForRoom } from '../../game.service.js';
import { cleanupGameShellRuntime } from '../../game.lifecycle.js';
import { broadcastGameShellState } from '../../game.timer.js';
import { clearGuessingChallengeRoomMode } from './mode-store.js';
import {
  startGuessingChallengePhaseTimerIfNeeded,
  stopGuessingChallengePhaseTimer,
} from './phase-timer.js';
import { applyRoundScores } from './scoring.js';
import {
  appendRecentIdentityIds,
  clearLookThrottleForRoom,
  createRoundState,
  withRound,
} from './state.js';
import { deleteGuessingChallengeState, setGuessingChallengeState } from './store.js';

function broadcastPhaseChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(GUESSING_CHALLENGE_PHASE_CHANGED_EVENT, {});
}

export function startRoundResults(
  io: Server,
  roomId: string,
  match: GuessingChallengeMatchState,
): GuessingChallengeMatchState {
  if (
    match.round.gamePhase === 'round-results' ||
    match.round.gamePhase === 'match-completed'
  ) {
    return match;
  }

  const scoredMatch = applyRoundScores(match);
  const nextMatch = withRound(scoredMatch, {
    ...scoredMatch.round,
    gamePhase: 'round-results',
    phaseRemainingSeconds: 0,
    cardConfirm: null,
  });

  setGuessingChallengeState(roomId, nextMatch);
  stopGuessingChallengePhaseTimer(roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

function startNextRound(
  io: Server,
  roomId: string,
  match: GuessingChallengeMatchState,
): GuessingChallengeMatchState {
  const startingTeamId = match.nextStartingTeamId;
  // Preserve match-scoped teamCards — do not reset between rounds.
  const round = createRoundState(
    roomId,
    match.teamByPlayerId,
    startingTeamId,
    match.recentIdentityIds,
  );

  const nextMatch: GuessingChallengeMatchState = {
    ...match,
    currentRound: match.currentRound + 1,
    matchStatus: 'in-progress',
    nextStartingTeamId: startingTeamId === 'blue' ? 'red' : 'blue',
    recentIdentityIds: appendRecentIdentityIds(match.recentIdentityIds, round.usedIdentityIds),
    round,
  };

  setGuessingChallengeState(roomId, nextMatch);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

function startMatchCompletedPhase(
  io: Server,
  roomId: string,
  match: GuessingChallengeMatchState,
): GuessingChallengeMatchState {
  const nextMatch = withRound(
    {
      ...match,
      matchStatus: 'completed',
    },
    {
      ...match.round,
      gamePhase: 'match-completed',
      phaseRemainingSeconds: timedPhaseDurations.matchResults(),
      cardConfirm: null,
    },
  );

  setGuessingChallengeState(roomId, nextMatch);
  startGuessingChallengePhaseTimerIfNeeded(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function continueFromRoundResults(
  io: Server,
  roomId: string,
  match: GuessingChallengeMatchState,
  shell: GameShellState,
  hostPlayerId: string,
): GuessingChallengeMatchState {
  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  if (shell.hostPlayerId !== hostPlayerId) {
    return match;
  }

  stopGuessingChallengePhaseTimer(roomId);

  if (match.currentRound < match.totalRounds) {
    return startNextRound(io, roomId, match);
  }

  return startMatchCompletedPhase(io, roomId, match);
}

export function completeMatch(io: Server, roomId: string): void {
  stopGuessingChallengePhaseTimer(roomId);
  clearLookThrottleForRoom(roomId);
  clearGuessingChallengeRoomMode(roomId);
  deleteGuessingChallengeState(roomId);

  const nextShell = finishGameShellForRoom(roomId);

  if (nextShell) {
    cleanupGameShellRuntime(roomId);
    broadcastGameShellState(io, nextShell);
  }
}

export { broadcastPhaseChanged };
