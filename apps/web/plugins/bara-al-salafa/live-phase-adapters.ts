import type { BaraAlSalafaPlayerView } from '@wanasatna/shared';
import { BARA_AL_SALAFA_ROUND_RESULTS_DURATION_SECONDS } from '@wanasatna/shared';
import type { LobbyPlayer } from '@/lib/lobby/types';
import type { DirectedQuestionsScreenProps } from './directed-questions-screen';
import type { ImpostorGuessOption } from './impostor-guess-screen';
import type { ImpostorGuessScreenProps } from './impostor-guess-screen';
import type { MatchResultsScreenProps } from './match-results-screen';
import type { RevealImpostorScreenProps } from './reveal-impostor-screen';
import type { RoundResultsScreenProps } from './round-results-screen';
import type { VotingScreenProps } from './voting-screen';

export function getParticipatingPlayers(players: LobbyPlayer[]): LobbyPlayer[] {
  return players.filter((participant) => !participant.isSpectator);
}

export function mapDirectedQuestionsLiveProps(
  view: BaraAlSalafaPlayerView,
  players: LobbyPlayer[],
  currentPlayerId: string,
  roomCode: string,
  deadlineAtMs: number | null | undefined,
): DirectedQuestionsScreenProps | null {
  const askerPlayerId = view.directedQuestionAskerPlayerId;
  const askerName = view.directedQuestionAskerName;
  const targetPlayerId = view.directedQuestionTargetPlayerId;
  const targetName = view.directedQuestionTargetName;

  if (
    !askerPlayerId ||
    !askerName ||
    !targetPlayerId ||
    !targetName ||
    view.directedQuestionTotalTurns <= 0
  ) {
    return null;
  }

  return {
    askerName,
    targetName,
    askerPlayerId,
    targetPlayerId,
    currentPlayerId,
    players: getParticipatingPlayers(players),
    currentTurn: view.directedQuestionCurrentTurn,
    totalTurns: view.directedQuestionTotalTurns,
    deadlineAtMs,
    remainingSeconds: 0,
    showTimer: true,
    roundNumber: view.currentRound,
    totalRounds: view.totalRounds,
    roomCode,
  };
}

export function mapVotingLiveProps(
  view: BaraAlSalafaPlayerView,
  players: LobbyPlayer[],
  currentPlayerId: string,
  roomCode: string,
  deadlineAtMs: number | null | undefined,
  isSubmitting: boolean,
  errorMessage: string | null,
): VotingScreenProps {
  const participatingPlayers = getParticipatingPlayers(players);
  const confirmedPlayerId =
    view.confirmedVoteTargetPlayerId &&
    participatingPlayers.some((participant) => participant.id === view.confirmedVoteTargetPlayerId)
      ? view.confirmedVoteTargetPlayerId
      : null;

  return {
    players: participatingPlayers,
    currentPlayerId,
    confirmedPlayerId,
    hasVoted: view.hasVoted,
    deadlineAtMs,
    remainingSeconds: 0,
    showTimer: true,
    submittedVotesCount: view.submittedVotesCount,
    eligibleVotersCount: view.eligibleVotersCount,
    roundNumber: view.currentRound,
    totalRounds: view.totalRounds,
    roomCode,
    isSubmitting,
    errorMessage,
    questionHelper: 'صوّت لمين تتوقع أنه برا السالفة',
  };
}

export function mapRevealImpostorLiveProps(
  view: BaraAlSalafaPlayerView,
  roomCode: string,
  deadlineAtMs: number | null | undefined,
): RevealImpostorScreenProps | null {
  if (!view.revealedImpostorPlayerId || !view.revealedImpostorName) {
    return null;
  }

  return {
    impostorPlayer: {
      id: view.revealedImpostorPlayerId,
      name: view.revealedImpostorName,
    },
    deadlineAtMs,
    remainingSeconds: 0,
    roundNumber: view.currentRound,
    totalRounds: view.totalRounds,
    roomCode,
  };
}

export function mapImpostorGuessOptions(words: readonly string[]): ImpostorGuessOption[] {
  return words.map((word) => ({
    id: word,
    label: word,
  }));
}

export function mapImpostorGuessLiveProps(
  view: BaraAlSalafaPlayerView,
  roomCode: string,
  deadlineAtMs: number | null | undefined,
): Pick<
  ImpostorGuessScreenProps,
  | 'isImpostor'
  | 'options'
  | 'hasSubmitted'
  | 'roundNumber'
  | 'totalRounds'
  | 'roomCode'
  | 'deadlineAtMs'
  | 'remainingSeconds'
  | 'showTimer'
> {
  return {
    isImpostor: view.isImpostorGuessActivePlayer,
    options: mapImpostorGuessOptions(view.impostorGuessOptions),
    hasSubmitted: view.hasSubmittedImpostorGuess,
    roundNumber: view.currentRound,
    totalRounds: view.totalRounds,
    roomCode,
    deadlineAtMs,
    remainingSeconds: 0,
    showTimer: true,
  };
}

export function mapRoundResultsLiveProps(
  view: BaraAlSalafaPlayerView,
  currentPlayerId: string,
  roomCode: string,
  deadlineAtMs: number | null | undefined,
): RoundResultsScreenProps | null {
  if (!view.revealedWord || !view.revealedImpostorPlayerId || !view.revealedImpostorName) {
    return null;
  }

  if (view.impostorGuessedCorrectly === null) {
    return null;
  }

  return {
    revealedWord: view.revealedWord,
    impostorPlayerId: view.revealedImpostorPlayerId,
    impostorPlayerName: view.revealedImpostorName,
    impostorGuessedCorrectly: view.impostorGuessedCorrectly,
    roundResults: view.roundResults.map((entry) => ({
      id: entry.playerId,
      name: entry.name,
      roundPoints: entry.roundPoints,
      totalPoints: entry.totalPoints,
      isImpostor: entry.isImpostor,
      earnedPoints: entry.earnedPoints,
    })),
    currentPlayerId,
    roundNumber: view.currentRound,
    totalRounds: view.totalRounds,
    remainingSeconds: 0,
    deadlineAtMs,
    totalDurationSeconds: BARA_AL_SALAFA_ROUND_RESULTS_DURATION_SECONDS,
    roomCode,
    continueLabel: view.canContinueFromRoundResults ? view.roundResultsContinueLabel : null,
    waitingMessage: view.roundResultsWaitingMessage,
  };
}

export function mapMatchResultsLiveProps(
  view: BaraAlSalafaPlayerView,
  currentPlayerId: string,
  roomCode: string,
): MatchResultsScreenProps {
  return {
    leaderboard: view.resultsLeaderboard.map((entry) => ({
      id: entry.playerId,
      name: entry.name,
      totalPoints: entry.totalPoints,
      rank: entry.rank,
      isFirstPlace: entry.isFirstPlace,
      isCurrentPlayer: entry.playerId === currentPlayerId,
    })),
    currentPlayerId,
    totalRounds: view.totalRounds,
    playerCount: view.matchPlayerCount,
    roomCode,
  };
}

export function resolveFreeQuestionActivePlayerId(
  view: BaraAlSalafaPlayerView,
  currentPlayerId: string,
  players: LobbyPlayer[],
): string | null {
  if (view.activeFreeQuestionPlayerId) {
    return view.activeFreeQuestionPlayerId;
  }

  if (view.isFreeQuestionActivePlayer) {
    return currentPlayerId;
  }

  if (!view.activeFreeQuestionPlayerName) {
    return null;
  }

  return (
    players.find((participant) => participant.name === view.activeFreeQuestionPlayerName)?.id ??
    null
  );
}
