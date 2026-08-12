import type { Server } from 'socket.io';
import type { FastAnswerMatchState, GameShellState } from '@wanasatna/shared';
import { FAST_ANSWER_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { getRoomChannel } from '../../../room/room.utils.js';
import { deleteGameShell, getGameShellByRoomId } from '../../game.service.js';
import { cleanupGameShellRuntime, navigateRoomToLobby } from '../../game.lifecycle.js';
import { clearRoomRoundCategory } from '../../runtime/round-category-store.js';
import {
  restartFastAnswerPhaseTimer,
  stopFastAnswerPhaseTimer,
  clearFastAnswerPhaseTimerRuntime,
} from './phase-timer.js';
import { applyRoundScores } from './scoring.js';
import {
  appendRecentQuestionId,
  createRoundState,
  withRound,
} from './state.js';
import { deleteFastAnswerState, getFastAnswerState, setFastAnswerState } from './store.js';

function broadcastPhaseChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(FAST_ANSWER_PHASE_CHANGED_EVENT, {});
}

export function startRoundResults(
  io: Server,
  roomId: string,
  match: FastAnswerMatchState,
): FastAnswerMatchState {
  if (match.round.gamePhase === 'round-results' || match.round.gamePhase === 'match-completed') {
    return match;
  }

  const scoredMatch = applyRoundScores(match);
  const nextMatch = withRound(scoredMatch, {
    ...scoredMatch.round,
    gamePhase: 'round-results',
    phaseRemainingSeconds: timedPhaseDurations.fastAnswerRoundResults(),
    deadlineAtMs: null,
  });

  setFastAnswerState(roomId, nextMatch);
  restartFastAnswerPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function finalizeQuestionRound(
  io: Server,
  roomId: string,
  match: FastAnswerMatchState,
  outcome: { winnerPlayerId: string | null; timedOut: boolean },
): FastAnswerMatchState {
  if (match.round.gamePhase !== 'question') {
    return match;
  }

  const endedMatch = withRound(match, {
    ...match.round,
    winnerPlayerId: outcome.winnerPlayerId,
    timedOut: outcome.timedOut,
    phaseRemainingSeconds: 0,
    deadlineAtMs: null,
  });

  return startRoundResults(io, roomId, endedMatch);
}

function startNextRound(
  io: Server,
  roomId: string,
  match: FastAnswerMatchState,
): FastAnswerMatchState {
  const nextRoundNumber = match.currentRound + 1;
  const round = createRoundState(
    match.lockedCategoryId,
    match.recentQuestionIds,
    match.roundTimeSeconds,
  );
  const nextMatch: FastAnswerMatchState = {
    ...match,
    currentRound: nextRoundNumber,
    matchStatus: 'in-progress',
    recentQuestionIds: appendRecentQuestionId(match.recentQuestionIds, round.questionId),
    round,
  };

  setFastAnswerState(roomId, nextMatch);
  restartFastAnswerPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

function startMatchCompletedPhase(
  io: Server,
  roomId: string,
  match: FastAnswerMatchState,
): FastAnswerMatchState {
  const nextMatch = withRound(
    {
      ...match,
      matchStatus: 'completed',
    },
    {
      ...match.round,
      gamePhase: 'match-completed',
      phaseRemainingSeconds: timedPhaseDurations.matchResults(),
      deadlineAtMs: null,
    },
  );

  setFastAnswerState(roomId, nextMatch);
  restartFastAnswerPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function advanceFromRoundResults(
  io: Server,
  roomId: string,
  match: FastAnswerMatchState,
): FastAnswerMatchState {
  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  stopFastAnswerPhaseTimer(roomId);

  if (match.currentRound < match.totalRounds) {
    return startNextRound(io, roomId, match);
  }

  return startMatchCompletedPhase(io, roomId, match);
}

export function continueFromRoundResults(
  io: Server,
  roomId: string,
  match: FastAnswerMatchState,
  shell: GameShellState,
  hostPlayerId: string,
): FastAnswerMatchState {
  if (shell.hostPlayerId !== hostPlayerId) {
    return match;
  }

  const current = getFastAnswerState(roomId) ?? match;

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
  clearFastAnswerPhaseTimerRuntime(roomId);
  deleteFastAnswerState(roomId);
  clearRoomRoundCategory(roomId);

  const shell = getGameShellByRoomId(roomId);
  if (!shell) {
    return;
  }

  cleanupGameShellRuntime(roomId);
  deleteGameShell(roomId);
  navigateRoomToLobby(io, roomId);
}
