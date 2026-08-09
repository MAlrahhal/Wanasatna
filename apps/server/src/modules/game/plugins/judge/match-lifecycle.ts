import type { Server } from 'socket.io';
import type { GameShellState, JudgeMatchState } from '@wanasatna/shared';
import { JUDGE_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { getRoomChannel } from '../../../room/room.utils.js';
import { finishGameShellForRoom } from '../../game.service.js';
import { cleanupGameShellRuntime } from '../../game.lifecycle.js';
import { broadcastGameShellState } from '../../game.timer.js';
import {
  startJudgePhaseTimerIfNeeded,
  stopJudgePhaseTimer,
} from './phase-timer.js';
import { applyRoundScores } from './scoring.js';
import {
  appendRecentPromptId,
  beginJudgingPhase,
  createRoundState,
  resolveJudgeForRound,
  withRound,
} from './state.js';
import { deleteJudgeState, setJudgeState } from './store.js';

function broadcastPhaseChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(JUDGE_PHASE_CHANGED_EVENT, {});
}

export function transitionToJudging(
  io: Server,
  roomId: string,
  match: JudgeMatchState,
): JudgeMatchState {
  const nextMatch = beginJudgingPhase(match);
  setJudgeState(roomId, nextMatch);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function startRoundResults(
  io: Server,
  roomId: string,
  match: JudgeMatchState,
): JudgeMatchState {
  if (match.round.gamePhase === 'round-results' || match.round.gamePhase === 'match-completed') {
    return match;
  }

  const scoredMatch = applyRoundScores(match);
  const nextMatch = withRound(scoredMatch, {
    ...scoredMatch.round,
    gamePhase: 'round-results',
    phaseRemainingSeconds: 0,
  });

  setJudgeState(roomId, nextMatch);
  stopJudgePhaseTimer(roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

function startNextRound(
  io: Server,
  roomId: string,
  match: JudgeMatchState,
): JudgeMatchState {
  const resolved = resolveJudgeForRound(match.judgeOrder, match.judgeOrderIndex);
  const round = createRoundState(roomId, resolved.judgePlayerId, match.recentPromptIds);
  const nextMatch: JudgeMatchState = {
    ...match,
    judgeOrder: resolved.nextOrder,
    judgeOrderIndex: resolved.nextIndex,
    currentRound: match.currentRound + 1,
    matchStatus: 'in-progress',
    recentPromptIds: appendRecentPromptId(match.recentPromptIds, round.promptId),
    round,
  };

  setJudgeState(roomId, nextMatch);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

function startMatchCompletedPhase(
  io: Server,
  roomId: string,
  match: JudgeMatchState,
): JudgeMatchState {
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

  setJudgeState(roomId, nextMatch);
  startJudgePhaseTimerIfNeeded(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function continueFromRoundResults(
  io: Server,
  roomId: string,
  match: JudgeMatchState,
  shell: GameShellState,
  hostPlayerId: string,
): JudgeMatchState {
  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  if (shell.hostPlayerId !== hostPlayerId) {
    return match;
  }

  stopJudgePhaseTimer(roomId);

  if (match.currentRound < match.totalRounds) {
    return startNextRound(io, roomId, match);
  }

  return startMatchCompletedPhase(io, roomId, match);
}

export function completeMatch(io: Server, roomId: string): void {
  stopJudgePhaseTimer(roomId);
  deleteJudgeState(roomId);

  const nextShell = finishGameShellForRoom(roomId);

  if (nextShell) {
    cleanupGameShellRuntime(roomId);
    broadcastGameShellState(io, nextShell);
  }
}
