import type { Server } from 'socket.io';
import type { GameShellState, GuessingChallengeMatchState } from '@wanasatna/shared';
import {
  GUESSING_CHALLENGE_GAME_ID,
  GUESSING_CHALLENGE_PHASE_CHANGED_EVENT,
} from '@wanasatna/shared';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { timedPhaseClock } from '../../runtime/phase-deadline.js';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { persistCompletedMatchThen } from '../../runtime/persist-completed-match.js';
import { teardownShellAndReturnToLobby } from '../../game.lifecycle.js';
import { clearRoomRoundCategory } from '../../runtime/round-category-store.js';
import { clearGuessingChallengeRoomMode } from './mode-store.js';
import {
  clearGuessingChallengePhaseTimerRuntime,
  restartGuessingChallengePhaseTimer,
  stopGuessingChallengePhaseTimer,
} from './phase-timer.js';
import { applyRoundScores } from './scoring.js';
import {
  appendRecentIdentityIds,
  clearLookThrottleForRoom,
  createRoundState,
  getEligibleTeamPlayerIds,
  markGuessingChallengePlayerDeparted,
  reconcilePendingCardConfirm,
  withRound,
} from './state.js';
import {
  deleteGuessingChallengeState,
  getGuessingChallengeState,
  setGuessingChallengeState,
} from './store.js';

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
    ...timedPhaseClock(timedPhaseDurations.guessingChallengeRoundResults()),
    cardConfirm: null,
  });

  setGuessingChallengeState(roomId, nextMatch);
  restartGuessingChallengePhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

function startNextRound(
  io: Server,
  roomId: string,
  match: GuessingChallengeMatchState,
): GuessingChallengeMatchState {
  const startingTeamId = match.nextStartingTeamId;
  const { round, usedRoundCategoryIds } = createRoundState(
    match.lockedCategoryId,
    match.usedRoundCategoryIds,
    match.teamByPlayerId,
    startingTeamId,
    match.recentIdentityIds,
  );

  const nextMatch: GuessingChallengeMatchState = {
    ...match,
    currentRound: match.currentRound + 1,
    matchStatus: 'in-progress',
    nextStartingTeamId: startingTeamId === 'blue' ? 'red' : 'blue',
    usedRoundCategoryIds,
    recentIdentityIds: appendRecentIdentityIds(match.recentIdentityIds, round.usedIdentityIds),
    round,
  };

  setGuessingChallengeState(roomId, nextMatch);
  restartGuessingChallengePhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function startGuessingChallengeMatchCompletedPhase(
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
      ...timedPhaseClock(timedPhaseDurations.matchResults()),
      winningTeamId: match.round.gamePhase === 'playing' ? null : match.round.winningTeamId,
      winningPlayerId: match.round.gamePhase === 'playing' ? null : match.round.winningPlayerId,
      winningGuess: match.round.gamePhase === 'playing' ? null : match.round.winningGuess,
      cardConfirm: null,
    },
  );

  setGuessingChallengeState(roomId, nextMatch);
  restartGuessingChallengePhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function advanceFromGuessingChallengeRoundResults(
  io: Server,
  roomId: string,
  match: GuessingChallengeMatchState,
): GuessingChallengeMatchState {
  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  stopGuessingChallengePhaseTimer(roomId);

  if (match.currentRound < match.totalRounds) {
    return startNextRound(io, roomId, match);
  }

  return startGuessingChallengeMatchCompletedPhase(io, roomId, match);
}

export function continueFromRoundResults(
  io: Server,
  roomId: string,
  match: GuessingChallengeMatchState,
  shell: GameShellState,
  hostPlayerId: string,
): GuessingChallengeMatchState {
  if (shell.hostPlayerId !== hostPlayerId) {
    return match;
  }

  const current = getGuessingChallengeState(roomId) ?? match;

  if (current.round.gamePhase === 'match-completed') {
    completeMatch(io, roomId);
    return current;
  }

  return advanceFromGuessingChallengeRoundResults(io, roomId, current);
}

export function completeMatch(io: Server, roomId: string): void {
  persistCompletedMatchThen(roomId, () => {
    clearGuessingChallengePhaseTimerRuntime(roomId);
    clearLookThrottleForRoom(roomId);
    clearGuessingChallengeRoomMode(roomId);
    clearRoomRoundCategory(roomId);
    deleteGuessingChallengeState(roomId);

    const shell = getGameShellByRoomId(roomId);
    if (!shell) {
      return;
    }

    teardownShellAndReturnToLobby(io, roomId);
  });
}

export function reconcileGuessingChallengeConnectivity(
  io: Server,
  roomId: string,
  shellOverride?: GameShellState,
): GuessingChallengeMatchState | null {
  const match = getGuessingChallengeState(roomId);
  const shell = shellOverride ?? getGameShellByRoomId(roomId);

  if (!match || !shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID) {
    return match;
  }

  const reconciled = reconcilePendingCardConfirm(match, shell);
  if (!reconciled.changed) {
    return match;
  }

  setGuessingChallengeState(roomId, reconciled.match);
  if (reconciled.activated) {
    restartGuessingChallengePhaseTimer(io, roomId);
  }
  broadcastPhaseChanged(io, roomId);
  return reconciled.match;
}

export function handleGuessingChallengePermanentLeave(
  io: Server,
  roomId: string,
  playerId: string,
): void {
  const match = getGuessingChallengeState(roomId);
  const shell = getGameShellByRoomId(roomId);

  if (!match || !shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID) {
    return;
  }

  const nextMatch = markGuessingChallengePlayerDeparted(match, playerId);
  if (nextMatch === match) {
    return;
  }

  setGuessingChallengeState(roomId, nextMatch);

  const blueRemaining = getEligibleTeamPlayerIds(nextMatch, 'blue').length;
  const redRemaining = getEligibleTeamPlayerIds(nextMatch, 'red').length;
  if (blueRemaining === 0 || redRemaining === 0) {
    startGuessingChallengeMatchCompletedPhase(io, roomId, nextMatch);
    return;
  }

  const reconciled = reconcilePendingCardConfirm(nextMatch, shell);
  if (reconciled.changed) {
    setGuessingChallengeState(roomId, reconciled.match);
    if (reconciled.activated) {
      restartGuessingChallengePhaseTimer(io, roomId);
    }
  }
  broadcastPhaseChanged(io, roomId);
}

export { broadcastPhaseChanged };
