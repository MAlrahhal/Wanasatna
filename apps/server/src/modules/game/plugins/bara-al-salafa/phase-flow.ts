import type { Server } from 'socket.io';
import type { BaraAlSalafaMatchState, GameShellState } from '@wanasatna/shared';
import { BARA_AL_SALAFA_GAME_ID, BARA_AL_SALAFA_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { opsLogger, sanitizeErrorName } from '../../../../lib/ops-logger.js';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import {
  buildDirectedQuestionPairsFromOrder,
  buildSpeakingOrder,
  DirectedQuestionPairsBuildError,
} from './speaking-order.js';
import {
  completeActiveFreeQuestionTurn,
  getRemainingFreeQuestionPlayerIds,
  isFreeQuestionsPhaseComplete,
  pickRandomPlayerId,
} from './free-questions.js';
import { timedPhaseClock } from '../../runtime/phase-deadline.js';
import { withRound } from './round-state.js';
import { applyVote, haveAllConnectedParticipantsVoted } from './voting.js';
import {
  applyRoleUnderstood,
  haveAllConnectedParticipantsAcknowledgedRole,
} from './role-understood.js';
import {
  applyImpostorGuessSubmission,
  buildRoundImpostorGuessOptions,
  finalizeImpostorGuessWithoutSubmission,
} from './impostor-guess.js';
import {
  completeMatchCompletedPhase,
  completeRoundResultsPhase,
  startRoundResultsPhase,
} from './match-lifecycle.js';
import { getLoadedGameContent } from '../../../content/index.js';
import { setBaraAlSalafaState } from './store.js';
import {
  registerBaraPhaseExpiredHandler,
  restartPhaseTimer,
  stopPhaseTimer,
} from './phase-timer.js';

function broadcastPhaseChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(BARA_AL_SALAFA_PHASE_CHANGED_EVENT, {});
}

function commitPhase(
  io: Server,
  roomId: string,
  nextMatch: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  setBaraAlSalafaState(roomId, nextMatch);
  restartPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);
  return nextMatch;
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
      opsLogger.error('directed-question-pairs-build-failed', 'تعذر تجهيز ترتيب الأسئلة.', {
        operation: 'build-directed-question-pairs',
        roomId,
        errorName: sanitizeErrorName(error),
      });
      return match;
    }

    throw error;
  }

  const turnSeconds = match.round.questionTurnDurationSeconds;

  return commitPhase(
    io,
    roomId,
    withRound(match, {
      ...match.round,
      gamePhase: 'directed-questions',
      ...timedPhaseClock(turnSeconds),
      speakingOrder,
      directedQuestionPairs,
      currentSpeakerIndex: 0,
    }),
  );
}

export function completeDescriptionPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  if (match.round.gamePhase !== 'description') {
    return match;
  }

  return startDirectedQuestionsPhase(io, roomId, match);
}

export function advanceDirectedQuestionTurn(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  if (match.round.gamePhase !== 'directed-questions') {
    return match;
  }

  const nextIndex = match.round.currentSpeakerIndex + 1;

  if (nextIndex >= match.round.directedQuestionPairs.length) {
    const shell = getGameShellByRoomId(roomId);

    if (!shell) {
      return match;
    }

    return startFreeQuestionsPhase(io, roomId, match, shell);
  }

  return commitPhase(
    io,
    roomId,
    withRound(match, {
      ...match.round,
      currentSpeakerIndex: nextIndex,
      ...timedPhaseClock(match.round.questionTurnDurationSeconds),
    }),
  );
}

export function startFreeQuestionsPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
): BaraAlSalafaMatchState {
  const clearedRound = {
    ...match.round,
    gamePhase: 'free-questions' as const,
    ...timedPhaseClock(match.round.questionTurnDurationSeconds),
    currentSpeakerIndex: match.round.directedQuestionPairs.length,
    completedFreeQuestionTurns: [],
    activeFreeQuestionPlayerId: null as string | null,
    pendingFreeQuestionTargetPlayerId: null as string | null,
  };

  const clearedMatch = withRound(match, clearedRound);
  const remainingPlayerIds = getRemainingFreeQuestionPlayerIds(shell, clearedMatch);
  const firstActivePlayerId = pickRandomPlayerId(remainingPlayerIds);

  return commitPhase(
    io,
    roomId,
    withRound(clearedMatch, {
      ...clearedRound,
      activeFreeQuestionPlayerId: firstActivePlayerId,
      ...timedPhaseClock(match.round.questionTurnDurationSeconds),
    }),
  );
}

export function applyFreeQuestionPlayerChoice(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  _shell: GameShellState,
  _activePlayerId: string,
  targetPlayerId: string,
): BaraAlSalafaMatchState {
  if (match.round.gamePhase !== 'free-questions') {
    return match;
  }

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
  if (match.round.gamePhase !== 'free-questions') {
    return match;
  }

  if (match.round.activeFreeQuestionPlayerId !== activePlayerId) {
    return match;
  }

  const targetPlayerId = match.round.pendingFreeQuestionTargetPlayerId;

  if (!targetPlayerId) {
    return match;
  }

  const nextMatch = completeActiveFreeQuestionTurn(match, activePlayerId);

  if (isFreeQuestionsPhaseComplete(shell, nextMatch)) {
    return startVotingPhase(io, roomId, nextMatch);
  }

  const remainingPlayerIds = getRemainingFreeQuestionPlayerIds(shell, nextMatch);
  const completedIds = new Set(nextMatch.round.completedFreeQuestionTurns);
  const nextActivePlayerId = completedIds.has(targetPlayerId)
    ? pickRandomPlayerId(remainingPlayerIds)
    : targetPlayerId;

  if (!nextActivePlayerId) {
    return startVotingPhase(io, roomId, nextMatch);
  }

  return commitPhase(
    io,
    roomId,
    withRound(nextMatch, {
      ...nextMatch.round,
      pendingFreeQuestionTargetPlayerId: null,
      activeFreeQuestionPlayerId: nextActivePlayerId,
      ...timedPhaseClock(nextMatch.round.questionTurnDurationSeconds),
    }),
  );
}

export function applyFreeQuestionSkipTurn(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
  activePlayerId: string,
): BaraAlSalafaMatchState {
  if (match.round.gamePhase !== 'free-questions') {
    return match;
  }

  if (
    match.round.activeFreeQuestionPlayerId &&
    match.round.activeFreeQuestionPlayerId !== activePlayerId
  ) {
    return match;
  }

  const turnOwner = match.round.activeFreeQuestionPlayerId ?? activePlayerId;
  const nextMatch = completeActiveFreeQuestionTurn(match, turnOwner);

  if (isFreeQuestionsPhaseComplete(shell, nextMatch)) {
    return startVotingPhase(io, roomId, nextMatch);
  }

  const remainingPlayerIds = getRemainingFreeQuestionPlayerIds(shell, nextMatch);
  const nextActivePlayerId = pickRandomPlayerId(remainingPlayerIds);

  if (!nextActivePlayerId) {
    return startVotingPhase(io, roomId, nextMatch);
  }

  return commitPhase(
    io,
    roomId,
    withRound(nextMatch, {
      ...nextMatch.round,
      pendingFreeQuestionTargetPlayerId: null,
      activeFreeQuestionPlayerId: nextActivePlayerId,
      ...timedPhaseClock(nextMatch.round.questionTurnDurationSeconds),
    }),
  );
}

export function startVotingPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  return commitPhase(
    io,
    roomId,
    withRound(match, {
      ...match.round,
      gamePhase: 'voting',
      ...timedPhaseClock(match.round.votingDurationSeconds),
      activeFreeQuestionPlayerId: null,
      pendingFreeQuestionTargetPlayerId: null,
      votes: {},
      submittedVoterIds: [],
    }),
  );
}

export function applyVoteSubmission(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
  voterId: string,
  targetPlayerId: string,
): BaraAlSalafaMatchState {
  if (match.round.gamePhase !== 'voting') {
    return match;
  }

  if (match.round.submittedVoterIds.includes(voterId)) {
    return match;
  }

  const nextMatch = applyVote(match, voterId, targetPlayerId);
  setBaraAlSalafaState(roomId, nextMatch);

  if (haveAllConnectedParticipantsVoted(shell, nextMatch)) {
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
  if (match.round.gamePhase !== 'voting') {
    return match;
  }

  return startRevealImpostorPhase(io, roomId, match);
}

export function completeVotingPhaseOnTimeout(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  return completeVotingPhase(io, roomId, match);
}

export function startRevealImpostorPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  return commitPhase(
    io,
    roomId,
    withRound(match, {
      ...match.round,
      gamePhase: 'reveal-impostor',
      ...timedPhaseClock(match.round.revealDurationSeconds),
    }),
  );
}

export function completeRevealImpostorPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  if (match.round.gamePhase !== 'reveal-impostor') {
    return match;
  }

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

  return commitPhase(
    io,
    roomId,
    withRound(match, {
      ...match.round,
      gamePhase: 'impostor-guess',
      ...timedPhaseClock(match.round.impostorGuessDurationSeconds),
      impostorGuessOptions,
      selectedWord: null,
      guessedCorrectly: null,
    }),
  );
}

export function applyImpostorGuessSubmissionAction(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
  playerId: string,
  selectedWord: string,
): BaraAlSalafaMatchState {
  if (match.round.gamePhase !== 'impostor-guess') {
    return match;
  }

  if (match.round.selectedWord !== null) {
    return match;
  }

  const nextMatch = applyImpostorGuessSubmission(match, playerId, selectedWord);
  setBaraAlSalafaState(roomId, nextMatch);

  return startGuessResultPhase(io, roomId, nextMatch, shell);
}

export function timeoutImpostorGuessPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
): BaraAlSalafaMatchState {
  if (match.round.gamePhase !== 'impostor-guess') {
    return match;
  }

  const finalizedMatch = finalizeImpostorGuessWithoutSubmission(match);
  return startGuessResultPhase(io, roomId, finalizedMatch, shell);
}

export function startGuessResultPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  _shell: GameShellState,
): BaraAlSalafaMatchState {
  const finalizedMatch =
    match.round.guessedCorrectly === null ? finalizeImpostorGuessWithoutSubmission(match) : match;

  return commitPhase(
    io,
    roomId,
    withRound(finalizedMatch, {
      ...finalizedMatch.round,
      gamePhase: 'impostor-guess-result',
      ...timedPhaseClock(finalizedMatch.round.guessResultDurationSeconds),
    }),
  );
}

export function completeGuessResultPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  if (match.round.gamePhase !== 'impostor-guess-result') {
    return match;
  }

  return startRoundResultsPhase(io, roomId, match);
}

export function completeImpostorGuessPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
): BaraAlSalafaMatchState {
  return startGuessResultPhase(io, roomId, match, shell);
}

export function applyRoleUnderstoodSubmission(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
  playerId: string,
): BaraAlSalafaMatchState {
  if (match.round.gamePhase !== 'description') {
    return match;
  }

  const nextMatch = applyRoleUnderstood(match, playerId);
  setBaraAlSalafaState(roomId, nextMatch);

  if (haveAllConnectedParticipantsAcknowledgedRole(shell, nextMatch)) {
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
  if (shell.hostPlayerId !== hostPlayerId) {
    return match;
  }

  if (match.round.gamePhase === 'match-completed') {
    stopPhaseTimer(roomId);
    completeMatchCompletedPhase(io, roomId);
    return match;
  }

  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  stopPhaseTimer(roomId);
  return completeRoundResultsPhase(io, roomId, match, shell);
}

export function handleBaraPhaseTimerExpired(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): void {
  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.phase !== 'PLAYING') {
    stopPhaseTimer(roomId);
    return;
  }

  switch (match.round.gamePhase) {
    case 'description':
      completeDescriptionPhase(io, roomId, match);
      return;
    case 'directed-questions':
      advanceDirectedQuestionTurn(io, roomId, match);
      return;
    case 'free-questions': {
      const activePlayerId = match.round.activeFreeQuestionPlayerId;
      if (!activePlayerId) {
        return;
      }
      applyFreeQuestionSkipTurn(io, roomId, match, shell, activePlayerId);
      return;
    }
    case 'voting':
      completeVotingPhaseOnTimeout(io, roomId, match);
      return;
    case 'reveal-impostor':
      completeRevealImpostorPhase(io, roomId, match);
      return;
    case 'impostor-guess':
      timeoutImpostorGuessPhase(io, roomId, match, shell);
      return;
    case 'impostor-guess-result':
      completeGuessResultPhase(io, roomId, match);
      return;
    case 'round-results':
      completeRoundResultsPhase(io, roomId, match, shell);
      return;
    case 'match-completed':
      completeMatchCompletedPhase(io, roomId);
      return;
    default:
      stopPhaseTimer(roomId);
  }
}

registerBaraPhaseExpiredHandler(handleBaraPhaseTimerExpired);
