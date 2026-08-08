import type { Server } from 'socket.io';
import type { BaraAlSalafaMatchState, GameShellState } from '@wanasatna/shared';
import {
  BARA_AL_SALAFA_PHASE_CHANGED_EVENT,
} from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { buildDirectedQuestionPairsFromOrder, buildSpeakingOrder, DirectedQuestionPairsBuildError } from './speaking-order.js';
import {
  completeActiveFreeQuestionTurn,
  getRemainingFreeQuestionPlayerIds,
  isFreeQuestionsPhaseComplete,
  pickRandomPlayerId,
} from './free-questions.js';
import { withRound } from './round-state.js';
import { applyVote, haveAllConnectedParticipantsVoted } from './voting.js';
import { applyRoleUnderstood, haveAllConnectedParticipantsAcknowledgedRole } from './role-understood.js';
import {
  applyImpostorGuessSubmission,
  buildRoundImpostorGuessOptions,
  finalizeImpostorGuessWithoutSubmission,
} from './impostor-guess.js';
import { completeRoundResultsPhase, startRoundResultsPhase } from './match-lifecycle.js';
import { getLoadedGameContent } from '../../../content/index.js';
import { BARA_AL_SALAFA_GAME_ID } from '@wanasatna/shared';
import { setBaraAlSalafaState } from './store.js';
import { startPhaseTimerIfNeeded, stopPhaseTimer } from './phase-timer.js';

function broadcastPhaseChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(BARA_AL_SALAFA_PHASE_CHANGED_EVENT, {});
}

export function startDirectedQuestionsPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  const speakingOrder = buildSpeakingOrder(match.playerIds);

  let directedQuestionPairs: BaraAlSalafaMatchState['round']['directedQuestionPairs'];

  try {
    directedQuestionPairs = buildDirectedQuestionPairsFromOrder(speakingOrder);
  } catch (error) {
    if (error instanceof DirectedQuestionPairsBuildError) {
      console.error('[bara-al-salafa] Failed to build directed question pairs:', error.message);
      return match;
    }

    throw error;
  }

  const nextMatch = withRound(match, {
    ...match.round,
    gamePhase: 'directed-questions',
    phaseRemainingSeconds: 0,
    speakingOrder,
    directedQuestionPairs,
    currentSpeakerIndex: 0,
  });

  stopPhaseTimer(roomId);
  setBaraAlSalafaState(roomId, nextMatch);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function completeDescriptionPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  return startDirectedQuestionsPhase(io, roomId, match);
}

export function advanceDirectedQuestionTurn(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  const nextIndex = match.round.currentSpeakerIndex + 1;

  if (nextIndex >= match.round.directedQuestionPairs.length) {
    const shell = getGameShellByRoomId(roomId);

    if (!shell) {
      return match;
    }

    return startFreeQuestionsPhase(io, roomId, match, shell);
  }

  const nextMatch = withRound(match, {
    ...match.round,
    currentSpeakerIndex: nextIndex,
    phaseRemainingSeconds: 0,
  });

  setBaraAlSalafaState(roomId, nextMatch);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function startFreeQuestionsPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
): BaraAlSalafaMatchState {
  stopPhaseTimer(roomId);

  const clearedRound = {
    ...match.round,
    gamePhase: 'free-questions' as const,
    phaseRemainingSeconds: 0,
    currentSpeakerIndex: match.round.directedQuestionPairs.length,
    completedFreeQuestionTurns: [],
    activeFreeQuestionPlayerId: null,
    pendingFreeQuestionTargetPlayerId: null,
  };

  const clearedMatch = withRound(match, clearedRound);
  const remainingPlayerIds = getRemainingFreeQuestionPlayerIds(shell, clearedMatch);
  const firstActivePlayerId = pickRandomPlayerId(remainingPlayerIds);

  const nextMatch = withRound(clearedMatch, {
    ...clearedRound,
    activeFreeQuestionPlayerId: firstActivePlayerId,
  });

  setBaraAlSalafaState(roomId, nextMatch);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function applyFreeQuestionPlayerChoice(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  _shell: GameShellState,
  _activePlayerId: string,
  targetPlayerId: string,
): BaraAlSalafaMatchState {
  const nextMatch = withRound(match, {
    ...match.round,
    pendingFreeQuestionTargetPlayerId: targetPlayerId,
  });

  setBaraAlSalafaState(roomId, nextMatch);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function applyFreeQuestionAdvance(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
  activePlayerId: string,
): BaraAlSalafaMatchState {
  const targetPlayerId = match.round.pendingFreeQuestionTargetPlayerId;

  if (!targetPlayerId) {
    return match;
  }

  let nextMatch = completeActiveFreeQuestionTurn(match, activePlayerId);

  if (isFreeQuestionsPhaseComplete(shell, nextMatch)) {
    const clearedMatch = withRound(nextMatch, {
      ...nextMatch.round,
      pendingFreeQuestionTargetPlayerId: null,
      activeFreeQuestionPlayerId: null,
    });
    setBaraAlSalafaState(roomId, clearedMatch);
    return startVotingPhase(io, roomId, clearedMatch);
  }

  const remainingPlayerIds = getRemainingFreeQuestionPlayerIds(shell, nextMatch);
  const completedIds = new Set(nextMatch.round.completedFreeQuestionTurns);
  const nextActivePlayerId = completedIds.has(targetPlayerId)
    ? pickRandomPlayerId(remainingPlayerIds)
    : targetPlayerId;

  if (!nextActivePlayerId) {
    const clearedMatch = withRound(nextMatch, {
      ...nextMatch.round,
      pendingFreeQuestionTargetPlayerId: null,
      activeFreeQuestionPlayerId: null,
    });
    setBaraAlSalafaState(roomId, clearedMatch);
    return startVotingPhase(io, roomId, clearedMatch);
  }

  nextMatch = withRound(nextMatch, {
    ...nextMatch.round,
    pendingFreeQuestionTargetPlayerId: null,
    activeFreeQuestionPlayerId: nextActivePlayerId,
  });

  setBaraAlSalafaState(roomId, nextMatch);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function applyFreeQuestionSkipTurn(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
  activePlayerId: string,
): BaraAlSalafaMatchState {
  let nextMatch = completeActiveFreeQuestionTurn(match, activePlayerId);

  if (isFreeQuestionsPhaseComplete(shell, nextMatch)) {
    setBaraAlSalafaState(roomId, nextMatch);
    return startVotingPhase(io, roomId, nextMatch);
  }

  const remainingPlayerIds = getRemainingFreeQuestionPlayerIds(shell, nextMatch);
  const nextActivePlayerId = pickRandomPlayerId(remainingPlayerIds);

  if (!nextActivePlayerId) {
    setBaraAlSalafaState(roomId, nextMatch);
    return startVotingPhase(io, roomId, nextMatch);
  }

  nextMatch = withRound(nextMatch, {
    ...nextMatch.round,
    activeFreeQuestionPlayerId: nextActivePlayerId,
  });

  setBaraAlSalafaState(roomId, nextMatch);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function startVotingPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  stopPhaseTimer(roomId);

  const nextMatch = withRound(match, {
    ...match.round,
    gamePhase: 'voting',
    phaseRemainingSeconds: 0,
    votingDurationSeconds: match.round.votingDurationSeconds,
    activeFreeQuestionPlayerId: null,
    votes: {},
    submittedVoterIds: [],
  });

  setBaraAlSalafaState(roomId, nextMatch);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function applyVoteSubmission(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
  voterId: string,
  targetPlayerId: string,
): BaraAlSalafaMatchState {
  const nextMatch = applyVote(match, voterId, targetPlayerId);

  setBaraAlSalafaState(roomId, nextMatch);

  if (haveAllConnectedParticipantsVoted(shell, nextMatch)) {
    stopPhaseTimer(roomId);
    return completeVotingPhase(io, roomId, nextMatch);
  }

  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function completeVotingPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  return startRevealImpostorPhase(io, roomId, match);
}

export function startRevealImpostorPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  const nextMatch = withRound(match, {
    ...match.round,
    gamePhase: 'reveal-impostor',
    phaseRemainingSeconds: match.round.revealDurationSeconds,
  });

  setBaraAlSalafaState(roomId, nextMatch);
  startPhaseTimerIfNeeded(io, roomId);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function completeRevealImpostorPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  return startImpostorGuessPhase(io, roomId, match);
}

export function startImpostorGuessPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  const content = getLoadedGameContent(BARA_AL_SALAFA_GAME_ID);

  if (!content) {
    return match;
  }

  const impostorGuessOptions = buildRoundImpostorGuessOptions(content.bundle, match);

  stopPhaseTimer(roomId);

  const nextMatch = withRound(match, {
    ...match.round,
    gamePhase: 'impostor-guess',
    phaseRemainingSeconds: 0,
    impostorGuessOptions,
    selectedWord: null,
    guessedCorrectly: null,
  });

  setBaraAlSalafaState(roomId, nextMatch);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function applyImpostorGuessSubmissionAction(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
  playerId: string,
  selectedWord: string,
): BaraAlSalafaMatchState {
  const nextMatch = applyImpostorGuessSubmission(match, playerId, selectedWord);

  setBaraAlSalafaState(roomId, nextMatch);

  return completeImpostorGuessPhase(io, roomId, nextMatch, shell);
}

export function completeImpostorGuessPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  _shell: GameShellState,
): BaraAlSalafaMatchState {
  const finalizedMatch = finalizeImpostorGuessWithoutSubmission(match);

  setBaraAlSalafaState(roomId, finalizedMatch);
  stopPhaseTimer(roomId);
  broadcastPhaseChanged(io, roomId);

  return startRoundResultsPhase(io, roomId, finalizedMatch);
}

export function applyRoleUnderstoodSubmission(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
  playerId: string,
): BaraAlSalafaMatchState {
  let nextMatch = applyRoleUnderstood(match, playerId);

  setBaraAlSalafaState(roomId, nextMatch);

  if (haveAllConnectedParticipantsAcknowledgedRole(shell, nextMatch)) {
    stopPhaseTimer(roomId);
    return completeDescriptionPhase(io, roomId, nextMatch);
  }

  broadcastPhaseChanged(io, roomId);
  return nextMatch;
}

export function applyDirectedQuestionAdvance(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  askerPlayerId: string,
): BaraAlSalafaMatchState {
  if (match.round.gamePhase !== 'directed-questions') {
    return match;
  }

  const currentPair = match.round.directedQuestionPairs[match.round.currentSpeakerIndex];

  if (!currentPair || currentPair.askerPlayerId !== askerPlayerId) {
    return match;
  }

  return advanceDirectedQuestionTurn(io, roomId, match);
}

export function applyHostContinueRoundResults(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
  hostPlayerId: string,
): BaraAlSalafaMatchState {
  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  if (shell.hostPlayerId !== hostPlayerId) {
    return match;
  }

  stopPhaseTimer(roomId);
  return completeRoundResultsPhase(io, roomId, match, shell);
}
