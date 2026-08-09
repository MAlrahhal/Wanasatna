import type { Server } from 'socket.io';
import type { GameShellState, WhoWroteItMatchState } from '@wanasatna/shared';
import { WHO_WROTE_IT_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { getRoomChannel } from '../../../room/room.utils.js';
import { finishGameShellForRoom } from '../../game.service.js';
import { cleanupGameShellRuntime } from '../../game.lifecycle.js';
import { broadcastGameShellState } from '../../game.timer.js';
import {
  startWhoWroteItPhaseTimerIfNeeded,
  stopWhoWroteItPhaseTimer,
} from './phase-timer.js';
import { applyRoundScores } from './scoring.js';
import {
  appendRecentQuestionId,
  beginGuessingPhase,
  createRoundState,
  withRound,
} from './state.js';
import { deleteWhoWroteItState, setWhoWroteItState } from './store.js';

function broadcastPhaseChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(WHO_WROTE_IT_PHASE_CHANGED_EVENT, {});
}

export function transitionToGuessing(
  io: Server,
  roomId: string,
  match: WhoWroteItMatchState,
): WhoWroteItMatchState {
  const nextMatch = beginGuessingPhase(match);
  setWhoWroteItState(roomId, nextMatch);
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
    phaseRemainingSeconds: 0,
  });

  setWhoWroteItState(roomId, nextMatch);
  stopWhoWroteItPhaseTimer(roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

function startNextRound(
  io: Server,
  roomId: string,
  match: WhoWroteItMatchState,
): WhoWroteItMatchState {
  const nextRoundNumber = match.currentRound + 1;
  const round = createRoundState(roomId, match.recentQuestionIds);
  const nextMatch: WhoWroteItMatchState = {
    ...match,
    currentRound: nextRoundNumber,
    matchStatus: 'in-progress',
    recentQuestionIds: appendRecentQuestionId(match.recentQuestionIds, round.questionId),
    round,
  };

  setWhoWroteItState(roomId, nextMatch);
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
      phaseRemainingSeconds: timedPhaseDurations.matchResults(),
    },
  );

  setWhoWroteItState(roomId, nextMatch);
  startWhoWroteItPhaseTimerIfNeeded(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function continueFromRoundResults(
  io: Server,
  roomId: string,
  match: WhoWroteItMatchState,
  shell: GameShellState,
  hostPlayerId: string,
): WhoWroteItMatchState {
  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  if (shell.hostPlayerId !== hostPlayerId) {
    return match;
  }

  stopWhoWroteItPhaseTimer(roomId);

  if (match.currentRound < match.totalRounds) {
    return startNextRound(io, roomId, match);
  }

  return startMatchCompletedPhase(io, roomId, match);
}

export function completeMatch(io: Server, roomId: string): void {
  stopWhoWroteItPhaseTimer(roomId);
  deleteWhoWroteItState(roomId);

  const nextShell = finishGameShellForRoom(roomId);

  if (nextShell) {
    cleanupGameShellRuntime(roomId);
    broadcastGameShellState(io, nextShell);
  }
}
