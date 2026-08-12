import type { Server } from 'socket.io';
import type { GameShellState, JudgeMatchState } from '@wanasatna/shared';
import { JUDGE_GAME_ID, JUDGE_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { getRoomChannel } from '../../../room/room.utils.js';
import { deleteGameShell, getGameShellByRoomId } from '../../game.service.js';
import { cleanupGameShellRuntime, navigateRoomToLobby } from '../../game.lifecycle.js';
import { clearRoomRoundCategory } from '../../runtime/round-category-store.js';
import {
  clearJudgePhaseTimerRuntime,
  restartJudgePhaseTimer,
  stopJudgePhaseTimer,
} from './phase-timer.js';
import { applyRoundScores } from './scoring.js';
import {
  allRequiredHaveAnswered,
  appendRecentPromptId,
  beginJudgingPhase,
  createRoundState,
  isDeparted,
  markPlayerDeparted,
  resolveNextRoundJudge,
  withRound,
} from './state.js';
import { deleteJudgeState, getJudgeState, setJudgeState } from './store.js';

function broadcastPhaseChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(JUDGE_PHASE_CHANGED_EVENT, {});
}

function remainingActiveCount(match: JudgeMatchState): number {
  return match.playerIds.filter((playerId) => !isDeparted(match, playerId)).length;
}

export function transitionToJudging(
  io: Server,
  roomId: string,
  match: JudgeMatchState,
): JudgeMatchState {
  if (match.round.gamePhase !== 'answering') {
    return match;
  }

  if (
    match.round.answers.length === 0 ||
    isDeparted(match, match.round.judgePlayerId)
  ) {
    return startRoundResults(io, roomId, match);
  }

  const nextMatch = beginJudgingPhase(match);
  setJudgeState(roomId, nextMatch);
  restartJudgePhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function maybeAdvanceAnswering(
  io: Server,
  roomId: string,
  match: JudgeMatchState,
  shell: GameShellState,
): JudgeMatchState {
  if (match.round.gamePhase !== 'answering') {
    return match;
  }

  if (!allRequiredHaveAnswered(match, shell)) {
    return match;
  }

  return transitionToJudging(io, roomId, match);
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
    phaseRemainingSeconds: timedPhaseDurations.judgeRoundResults(),
    deadlineAtMs: null,
  });

  setJudgeState(roomId, nextMatch);
  restartJudgePhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

function startNextRound(
  io: Server,
  roomId: string,
  match: JudgeMatchState,
): JudgeMatchState {
  const resolved = resolveNextRoundJudge(match);

  if (!resolved) {
    return startMatchCompletedPhase(io, roomId, match);
  }

  const { round, usedRoundCategoryIds } = createRoundState(
    match.lockedCategoryId,
    match.usedRoundCategoryIds,
    match.recentPromptIds,
    resolved.judgePlayerId,
  );

  const nextMatch: JudgeMatchState = {
    ...match,
    judgeOrderIndex: resolved.nextIndex,
    currentRound: match.currentRound + 1,
    matchStatus: 'in-progress',
    usedRoundCategoryIds,
    recentPromptIds: appendRecentPromptId(match.recentPromptIds, round.promptId),
    round,
  };

  setJudgeState(roomId, nextMatch);

  const shell = getGameShellByRoomId(roomId);
  if (shell) {
    const advanced = maybeAdvanceAnswering(io, roomId, nextMatch, shell);
    if (advanced !== nextMatch) {
      return advanced;
    }
  }

  restartJudgePhaseTimer(io, roomId);
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
      deadlineAtMs: null,
    },
  );

  setJudgeState(roomId, nextMatch);
  restartJudgePhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function advanceFromRoundResults(
  io: Server,
  roomId: string,
  match: JudgeMatchState,
): JudgeMatchState {
  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  stopJudgePhaseTimer(roomId);

  if (remainingActiveCount(match) < 2 || !resolveNextRoundJudge(match)) {
    return startMatchCompletedPhase(io, roomId, match);
  }

  return startNextRound(io, roomId, match);
}

export function continueFromRoundResults(
  io: Server,
  roomId: string,
  match: JudgeMatchState,
  shell: GameShellState,
  hostPlayerId: string,
): JudgeMatchState {
  if (shell.hostPlayerId !== hostPlayerId) {
    return match;
  }

  const current = getJudgeState(roomId) ?? match;

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
  clearJudgePhaseTimerRuntime(roomId);
  deleteJudgeState(roomId);
  clearRoomRoundCategory(roomId);

  const shell = getGameShellByRoomId(roomId);
  if (!shell) {
    return;
  }

  cleanupGameShellRuntime(roomId);
  deleteGameShell(roomId);
  navigateRoomToLobby(io, roomId);
}

export function handleJudgePermanentLeave(
  io: Server,
  roomId: string,
  playerId: string,
): void {
  const match = getJudgeState(roomId);
  const shell = getGameShellByRoomId(roomId);

  if (!match || !shell || shell.gameId !== JUDGE_GAME_ID) {
    return;
  }

  const nextMatch = markPlayerDeparted(match, playerId);
  setJudgeState(roomId, nextMatch);

  const isCurrentJudge = nextMatch.round.judgePlayerId === playerId;
  const phase = nextMatch.round.gamePhase;

  if (
    isCurrentJudge &&
    (phase === 'answering' || phase === 'judging') &&
    nextMatch.round.winningAnswerId === null
  ) {
    startRoundResults(io, roomId, nextMatch);
    return;
  }

  if (phase === 'answering') {
    maybeAdvanceAnswering(io, roomId, nextMatch, shell);
    return;
  }

  broadcastPhaseChanged(io, roomId);
}
