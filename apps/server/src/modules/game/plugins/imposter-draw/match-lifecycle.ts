import type { Server } from 'socket.io';
import type { GameShellState, ImposterDrawMatchState } from '@wanasatna/shared';
import { IMPOSTER_DRAW_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { randomUUID } from 'node:crypto';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { timedPhaseClock } from '../../runtime/phase-deadline.js';
import { getRoomChannel } from '../../../room/room.utils.js';
import { deleteGameShell, getGameShellByRoomId } from '../../game.service.js';
import { cleanupGameShellRuntime, navigateRoomToLobby } from '../../game.lifecycle.js';
import { buildImageGuessOptions } from './images.js';
import {
  clearImposterDrawPhaseTimerRuntime,
  restartImposterDrawPhaseTimer,
  stopImposterDrawPhaseTimer,
} from './phase-timer.js';
import { applyRoundScores } from './scoring.js';
import { createRoundState, withRound } from './state.js';
import { deleteImposterDrawState, setImposterDrawState } from './store.js';
import {
  applyVote,
  getConnectedParticipantIds,
  haveAllConnectedParticipantsVoted,
  resolveImpostorVotedOut,
} from './voting.js';

function broadcastPhaseChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(IMPOSTER_DRAW_PHASE_CHANGED_EVENT, {});
}

export function haveAllConnectedParticipantsAcknowledgedBriefing(
  shell: GameShellState,
  match: ImposterDrawMatchState,
): boolean {
  const connectedIds = getConnectedParticipantIds(shell, match);

  if (connectedIds.length === 0) {
    return false;
  }

  const acknowledgedIds = new Set(match.round.roleUnderstoodPlayerIds);
  return connectedIds.every((playerId) => acknowledgedIds.has(playerId));
}

export function startDrawingPhase(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
): ImposterDrawMatchState {
  if (match.round.gamePhase !== 'briefing') {
    return match;
  }

  const nextMatch = withRound(match, {
    ...match.round,
    gamePhase: 'drawing-turns',
    turnId: randomUUID(),
    currentDrawerIndex: 0,
    currentTurnStrokeIds: [],
    ...timedPhaseClock(match.round.turnDurationSeconds),
  });

  setImposterDrawState(roomId, nextMatch);
  restartImposterDrawPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function applyBriefingAcknowledgement(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
  shell: GameShellState,
  playerId: string,
): ImposterDrawMatchState {
  if (match.round.gamePhase !== 'briefing') {
    return match;
  }

  if (match.round.roleUnderstoodPlayerIds.includes(playerId)) {
    return match;
  }

  const acknowledged = withRound(match, {
    ...match.round,
    roleUnderstoodPlayerIds: [...match.round.roleUnderstoodPlayerIds, playerId],
  });

  setImposterDrawState(roomId, acknowledged);

  if (haveAllConnectedParticipantsAcknowledgedBriefing(shell, acknowledged)) {
    return startDrawingPhase(io, roomId, acknowledged);
  }

  broadcastPhaseChanged(io, roomId);
  return acknowledged;
}

export function advanceDrawingTurn(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
): ImposterDrawMatchState {
  if (match.round.gamePhase !== 'drawing-turns') {
    return match;
  }

  const nextIndex = match.round.currentDrawerIndex + 1;

  if (nextIndex >= match.round.drawingOrder.length) {
    return startVotingPhase(io, roomId, match);
  }

  const nextMatch = withRound(match, {
    ...match.round,
    turnId: randomUUID(),
    currentDrawerIndex: nextIndex,
    currentTurnStrokeIds: [],
    ...timedPhaseClock(match.round.turnDurationSeconds),
  });

  setImposterDrawState(roomId, nextMatch);
  restartImposterDrawPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function startVotingPhase(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
): ImposterDrawMatchState {
  const nextMatch = withRound(match, {
    ...match.round,
    gamePhase: 'voting',
    ...timedPhaseClock(timedPhaseDurations.imposterDrawVoting()),
    currentDrawerIndex: match.round.drawingOrder.length,
    votes: {},
    submittedVoterIds: [],
  });

  setImposterDrawState(roomId, nextMatch);
  restartImposterDrawPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function applyVoteSubmission(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
  shell: GameShellState,
  voterId: string,
  targetPlayerId: string,
): ImposterDrawMatchState {
  const nextMatch = applyVote(match, voterId, targetPlayerId);
  setImposterDrawState(roomId, nextMatch);

  if (haveAllConnectedParticipantsVoted(shell, nextMatch)) {
    return completeVotingPhase(io, roomId, nextMatch);
  }

  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function completeVotingPhase(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
): ImposterDrawMatchState {
  const impostorVotedOut = resolveImpostorVotedOut(match);

  const nextMatch = withRound(match, {
    ...match.round,
    impostorVotedOut,
    gamePhase: 'reveal',
    ...timedPhaseClock(match.round.revealDurationSeconds),
  });

  setImposterDrawState(roomId, nextMatch);
  restartImposterDrawPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function completeRevealPhase(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
): ImposterDrawMatchState {
  return startImpostorGuessPhase(io, roomId, match);
}

export function startImpostorGuessPhase(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
): ImposterDrawMatchState {
  const options = buildImageGuessOptions(match.round.imageLabel, match.round.imageCategoryId);

  const nextMatch = withRound(match, {
    ...match.round,
    gamePhase: 'impostor-guess',
    ...timedPhaseClock(timedPhaseDurations.imposterDrawGuess()),
    impostorGuessOptions: options,
    selectedImageGuess: null,
    impostorGuessedCorrectly: null,
  });

  setImposterDrawState(roomId, nextMatch);
  restartImposterDrawPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function startGuessResultPhase(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
): ImposterDrawMatchState {
  const nextMatch = withRound(match, {
    ...match.round,
    gamePhase: 'guess-result',
    ...timedPhaseClock(timedPhaseDurations.imposterDrawGuessResult()),
  });

  setImposterDrawState(roomId, nextMatch);
  restartImposterDrawPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function applyImageGuessSubmission(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
  playerId: string,
  selectedWord: string,
): ImposterDrawMatchState {
  if (
    match.round.gamePhase !== 'impostor-guess' ||
    playerId !== match.round.impostorPlayerId ||
    match.round.selectedImageGuess !== null
  ) {
    return match;
  }

  if (!match.round.impostorGuessOptions.includes(selectedWord)) {
    return match;
  }

  const nextMatch = withRound(match, {
    ...match.round,
    selectedImageGuess: selectedWord,
    impostorGuessedCorrectly: selectedWord === match.round.imageLabel,
    phaseRemainingSeconds: 0,
    deadlineAtMs: null,
  });

  return startGuessResultPhase(io, roomId, nextMatch);
}

export function finalizeImageGuessWithoutSubmission(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
): ImposterDrawMatchState {
  if (match.round.gamePhase !== 'impostor-guess') {
    return match;
  }

  if (match.round.selectedImageGuess !== null) {
    return startGuessResultPhase(io, roomId, match);
  }

  const nextMatch = withRound(match, {
    ...match.round,
    selectedImageGuess: null,
    impostorGuessedCorrectly: false,
    phaseRemainingSeconds: 0,
    deadlineAtMs: null,
  });

  return startGuessResultPhase(io, roomId, nextMatch);
}

export function startRoundResults(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
): ImposterDrawMatchState {
  if (match.round.gamePhase === 'round-results') {
    return match;
  }

  const scoredMatch = applyRoundScores(match);
  const nextMatch = withRound(scoredMatch, {
    ...scoredMatch.round,
    gamePhase: 'round-results',
    ...timedPhaseClock(timedPhaseDurations.imposterDrawRoundResults()),
  });

  setImposterDrawState(roomId, nextMatch);
  restartImposterDrawPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

function startNextRound(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
): ImposterDrawMatchState {
  const { round, usedImageTexts } = createRoundState(roomId, {
    playerIds: match.playerIds,
    usedImageTexts: match.usedImageTexts,
    previousImpostorPlayerId: match.round.impostorPlayerId,
  });

  const nextMatch: ImposterDrawMatchState = {
    ...match,
    currentRound: match.currentRound + 1,
    matchStatus: 'in-progress',
    usedImageTexts,
    previousImpostorPlayerId: match.round.impostorPlayerId,
    round,
  };

  setImposterDrawState(roomId, nextMatch);
  restartImposterDrawPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

function startMatchCompletedPhase(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
): ImposterDrawMatchState {
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

  setImposterDrawState(roomId, nextMatch);
  restartImposterDrawPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function advanceFromRoundResults(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
): ImposterDrawMatchState {
  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  stopImposterDrawPhaseTimer(roomId);

  if (match.currentRound < match.totalRounds) {
    return startNextRound(io, roomId, match);
  }

  return startMatchCompletedPhase(io, roomId, match);
}

export function continueFromRoundResults(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
  shell: GameShellState,
  hostPlayerId: string,
): ImposterDrawMatchState {
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
  clearImposterDrawPhaseTimerRuntime(roomId);
  deleteImposterDrawState(roomId);

  const shell = getGameShellByRoomId(roomId);
  if (!shell) {
    return;
  }

  cleanupGameShellRuntime(roomId);
  deleteGameShell(roomId);
  navigateRoomToLobby(io, roomId);
}
