import type { Server } from 'socket.io';
import type { GameShellState, ImposterDrawMatchState } from '@wanasatna/shared';
import { IMPOSTER_DRAW_GAME_ID, IMPOSTER_DRAW_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { getLoadedGameContent } from '../../../content/index.js';
import { getRoomChannel } from '../../../room/room.utils.js';
import { finishGameShellForRoom } from '../../game.service.js';
import { cleanupGameShellRuntime } from '../../game.lifecycle.js';
import { broadcastGameShellState } from '../../game.timer.js';
import { buildImageGuessOptions } from './images.js';
import {
  startImposterDrawPhaseTimerIfNeeded,
  stopImposterDrawPhaseTimer,
} from './phase-timer.js';
import { applyRoundScores } from './scoring.js';
import { createRoundState, withRound } from './state.js';
import { deleteImposterDrawState, setImposterDrawState } from './store.js';
import { applyVote, haveAllConnectedParticipantsVoted, resolveImpostorVotedOut } from './voting.js';

function broadcastPhaseChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(IMPOSTER_DRAW_PHASE_CHANGED_EVENT, {});
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
    currentDrawerIndex: nextIndex,
    phaseRemainingSeconds: match.round.turnDurationSeconds,
  });

  setImposterDrawState(roomId, nextMatch);
  stopImposterDrawPhaseTimer(roomId);
  startImposterDrawPhaseTimerIfNeeded(io, roomId);
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
    phaseRemainingSeconds: 0,
    currentDrawerIndex: match.round.drawingOrder.length,
    votes: {},
    submittedVoterIds: [],
  });

  setImposterDrawState(roomId, nextMatch);
  stopImposterDrawPhaseTimer(roomId);
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
    phaseRemainingSeconds: match.round.revealDurationSeconds,
  });

  setImposterDrawState(roomId, nextMatch);
  stopImposterDrawPhaseTimer(roomId);
  startImposterDrawPhaseTimerIfNeeded(io, roomId);
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
    phaseRemainingSeconds: 0,
    impostorGuessOptions: options,
    selectedImageGuess: null,
    impostorGuessedCorrectly: null,
  });

  setImposterDrawState(roomId, nextMatch);
  stopImposterDrawPhaseTimer(roomId);
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
  });

  return startRoundResults(io, roomId, nextMatch);
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
    return startRoundResults(io, roomId, match);
  }

  const nextMatch = withRound(match, {
    ...match.round,
    selectedImageGuess: null,
    impostorGuessedCorrectly: false,
    phaseRemainingSeconds: 0,
  });

  return startRoundResults(io, roomId, nextMatch);
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
    phaseRemainingSeconds: 0,
  });

  setImposterDrawState(roomId, nextMatch);
  stopImposterDrawPhaseTimer(roomId);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

function startNextRound(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
): ImposterDrawMatchState {
  const content = getLoadedGameContent(IMPOSTER_DRAW_GAME_ID);

  if (!content) {
    return match;
  }

  const nextRoundNumber = match.currentRound + 1;
  const nextMatch: ImposterDrawMatchState = {
    ...match,
    currentRound: nextRoundNumber,
    matchStatus: 'in-progress',
    round: createRoundState(roomId, match.playerIds, content.settings),
  };

  setImposterDrawState(roomId, nextMatch);
  startImposterDrawPhaseTimerIfNeeded(io, roomId);
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
      phaseRemainingSeconds: timedPhaseDurations.matchResults(),
    },
  );

  setImposterDrawState(roomId, nextMatch);
  startImposterDrawPhaseTimerIfNeeded(io, roomId);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function continueFromRoundResults(
  io: Server,
  roomId: string,
  match: ImposterDrawMatchState,
  shell: GameShellState,
  hostPlayerId: string,
): ImposterDrawMatchState {
  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  if (shell.hostPlayerId !== hostPlayerId) {
    return match;
  }

  stopImposterDrawPhaseTimer(roomId);

  if (match.currentRound < match.totalRounds) {
    return startNextRound(io, roomId, match);
  }

  return startMatchCompletedPhase(io, roomId, match);
}

export function completeMatch(io: Server, roomId: string): void {
  stopImposterDrawPhaseTimer(roomId);
  deleteImposterDrawState(roomId);

  const nextShell = finishGameShellForRoom(roomId);

  if (nextShell) {
    cleanupGameShellRuntime(roomId);
    broadcastGameShellState(io, nextShell);
  }
}
