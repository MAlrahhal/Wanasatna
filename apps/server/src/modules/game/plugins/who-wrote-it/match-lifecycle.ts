import type { Server } from 'socket.io';
import type { GameShellState, WhoWroteItMatchState } from '@wanasatna/shared';
import { WHO_WROTE_IT_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { timedPhaseClock } from '../../runtime/phase-deadline.js';
import { getRoomChannel } from '../../../room/room.utils.js';
import { deleteGameShell, getGameShellByRoomId } from '../../game.service.js';
import { cleanupGameShellRuntime, navigateRoomToLobby } from '../../game.lifecycle.js';
import { clearRoomRoundCategory } from '../../runtime/round-category-store.js';
import {
  clearWhoWroteItPhaseTimerRuntime,
  restartWhoWroteItPhaseTimer,
  stopWhoWroteItPhaseTimer,
} from './phase-timer.js';
import { applyRoundScores } from './scoring.js';
import {
  allRequiredHaveGuessedCurrent,
  appendRecentQuestionId,
  advanceGlobalAnswerOrComplete,
  beginGuessingPhase,
  createRoundState,
  withRound,
} from './state.js';
import { deleteWhoWroteItState, getWhoWroteItState, setWhoWroteItState } from './store.js';

function broadcastPhaseChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(WHO_WROTE_IT_PHASE_CHANGED_EVENT, {});
}

export function advanceGuessingIfReady(
  io: Server,
  roomId: string,
  match: WhoWroteItMatchState,
  shell: GameShellState,
): WhoWroteItMatchState {
  let current = match;

  while (
    current.round.gamePhase === 'guessing' &&
    allRequiredHaveGuessedCurrent(current, shell)
  ) {
    const advanced = advanceGlobalAnswerOrComplete(current);

    if (advanced.completed) {
      return startRoundResults(io, roomId, advanced.match);
    }

    current = advanced.match;
    setWhoWroteItState(roomId, current);
  }

  if (current !== match) {
    restartWhoWroteItPhaseTimer(io, roomId);
    broadcastPhaseChanged(io, roomId);
  }

  return current;
}

export function transitionToGuessing(
  io: Server,
  roomId: string,
  match: WhoWroteItMatchState,
): WhoWroteItMatchState {
  if (match.round.gamePhase !== 'answering') {
    return match;
  }

  if (match.round.answers.length === 0) {
    return startRoundResults(io, roomId, match);
  }

  const nextMatch = beginGuessingPhase(match);
  setWhoWroteItState(roomId, nextMatch);

  const shell = getGameShellByRoomId(roomId);
  if (shell) {
    const advanced = advanceGuessingIfReady(io, roomId, nextMatch, shell);
    if (advanced !== nextMatch) {
      return advanced;
    }
  }

  restartWhoWroteItPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function startRoundResults(
  io: Server,
  roomId: string,
  match: WhoWroteItMatchState,
): WhoWroteItMatchState {
  if (match.round.gamePhase === 'round-results' || match.round.gamePhase === 'match-completed') {
    return match;
  }

  const scoredMatch = applyRoundScores(match);
  const nextMatch = withRound(scoredMatch, {
    ...scoredMatch.round,
    gamePhase: 'round-results',
    ...timedPhaseClock(timedPhaseDurations.whoWroteItRoundResults()),
  });

  setWhoWroteItState(roomId, nextMatch);
  restartWhoWroteItPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

function startNextRound(
  io: Server,
  roomId: string,
  match: WhoWroteItMatchState,
): WhoWroteItMatchState {
  const nextRoundNumber = match.currentRound + 1;
  const { round, usedRoundCategoryIds } = createRoundState(
    match.lockedCategoryId,
    match.usedRoundCategoryIds,
    match.recentQuestionIds,
  );
  const nextMatch: WhoWroteItMatchState = {
    ...match,
    currentRound: nextRoundNumber,
    matchStatus: 'in-progress',
    usedRoundCategoryIds,
    recentQuestionIds: appendRecentQuestionId(match.recentQuestionIds, round.questionId),
    round,
  };

  setWhoWroteItState(roomId, nextMatch);
  restartWhoWroteItPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

function startMatchCompletedPhase(
  io: Server,
  roomId: string,
  match: WhoWroteItMatchState,
): WhoWroteItMatchState {
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

  setWhoWroteItState(roomId, nextMatch);
  restartWhoWroteItPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function advanceFromRoundResults(
  io: Server,
  roomId: string,
  match: WhoWroteItMatchState,
): WhoWroteItMatchState {
  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  stopWhoWroteItPhaseTimer(roomId);

  if (match.currentRound < match.totalRounds) {
    return startNextRound(io, roomId, match);
  }

  return startMatchCompletedPhase(io, roomId, match);
}

export function continueFromRoundResults(
  io: Server,
  roomId: string,
  match: WhoWroteItMatchState,
  shell: GameShellState,
  hostPlayerId: string,
): WhoWroteItMatchState {
  if (shell.hostPlayerId !== hostPlayerId) {
    return match;
  }

  const current = getWhoWroteItState(roomId) ?? match;

  if (current.round.gamePhase === 'match-completed') {
    completeMatch(io, roomId);
    return current;
  }

  if (current.round.gamePhase !== 'round-results') {
    return current;
  }

  return advanceFromRoundResults(io, roomId, current);
}

export function completeMatch(io: Server, roomId: string): void {
  clearWhoWroteItPhaseTimerRuntime(roomId);
  deleteWhoWroteItState(roomId);
  clearRoomRoundCategory(roomId);

  const shell = getGameShellByRoomId(roomId);
  if (!shell) {
    return;
  }

  cleanupGameShellRuntime(roomId);
  deleteGameShell(roomId);
  navigateRoomToLobby(io, roomId);
}
