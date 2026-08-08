import type {
  GameContentSettings,
  GameShellPlayer,
  GameShellState,
  ImposterDrawMatchState,
  ImposterDrawPlayerView,
  ImposterDrawRoundState,
} from '@wanasatna/shared';
import {
  IMPOSTER_DRAW_DEFAULT_ROUNDS,
  IMPOSTER_DRAW_GUESS_SECONDS,
  IMPOSTER_DRAW_REVEAL_SECONDS,
  IMPOSTER_DRAW_TURN_SECONDS,
} from '@wanasatna/shared';
import {
  resolveDescriptionDurationSeconds,
  resolveMatchRounds,
  resolveTimedPhaseSeconds,
} from '../../../../config/test-timers.js';
import { buildPlaceholderImageUrl, pickImposterDrawImage } from './images.js';
import {
  buildLeaderboardEntries,
  buildResultsLeaderboardEntries,
  buildRoundResultEntries,
  didPlayersWin,
} from './scoring.js';
import { buildVoteTally, getConnectedParticipantIds } from './voting.js';

export { getConnectedParticipantIds };

const PHASE_LABELS = {
  'drawing-turns': 'دور الرسم',
  voting: 'التصويت',
  reveal: 'الكشف',
  'impostor-guess': 'تخمين الصورة',
  'round-results': 'نتيجة الجولة',
  'match-completed': 'انتهت المباراة',
} as const;

function shufflePlayerIds(playerIds: string[]): string[] {
  const copy = [...playerIds];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index]!;
    copy[index] = copy[swapIndex]!;
    copy[swapIndex] = current;
  }

  return copy;
}

export function resolveTotalRounds(settings: GameContentSettings): number {
  return resolveMatchRounds(settings.rounds, IMPOSTER_DRAW_DEFAULT_ROUNDS);
}

export function resolveTurnDurationSeconds(settings: GameContentSettings): number {
  return resolveDescriptionDurationSeconds(settings.roundTime ?? IMPOSTER_DRAW_TURN_SECONDS);
}

export function createInitialScores(playerIds: string[]): Record<string, number> {
  return Object.fromEntries(playerIds.map((playerId) => [playerId, 0]));
}

export function withRound(
  match: ImposterDrawMatchState,
  round: ImposterDrawRoundState,
): ImposterDrawMatchState {
  return {
    ...match,
    round,
  };
}

export function createRoundState(
  roomId: string,
  playerIds: string[],
  settings: GameContentSettings,
): ImposterDrawRoundState {
  const imageEntry = pickImposterDrawImage(roomId);
  const turnDurationSeconds = resolveTurnDurationSeconds(settings);
  const drawingOrder = shufflePlayerIds(playerIds);
  const impostorPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)]!;

  return {
    imageId: imageEntry.id,
    imageLabel: imageEntry.text,
    imageUrl: buildPlaceholderImageUrl(imageEntry.text),
    imageCategoryId: imageEntry.categoryId,
    impostorPlayerId,
    drawingOrder,
    currentDrawerIndex: 0,
    turnDurationSeconds,
    gamePhase: 'drawing-turns',
    phaseRemainingSeconds: turnDurationSeconds,
    strokes: [],
    votes: {},
    submittedVoterIds: [],
    impostorVotedOut: null,
    impostorGuessOptions: [],
    selectedImageGuess: null,
    impostorGuessedCorrectly: null,
    revealDurationSeconds: resolveTimedPhaseSeconds(IMPOSTER_DRAW_REVEAL_SECONDS),
    guessDurationSeconds: resolveTimedPhaseSeconds(IMPOSTER_DRAW_GUESS_SECONDS),
  };
}

export function createMatchState(
  roomId: string,
  players: GameShellPlayer[],
  settings: GameContentSettings,
): ImposterDrawMatchState {
  if (players.length === 0) {
    throw new Error('No players available for Imposter Draw match.');
  }

  const playerIds = players.map((player) => player.id);

  return {
    playerIds,
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    currentRound: 1,
    totalRounds: resolveTotalRounds(settings),
    scores: createInitialScores(playerIds),
    matchStatus: 'in-progress',
    round: createRoundState(roomId, playerIds, settings),
  };
}

function buildRoundPhaseLabel(match: ImposterDrawMatchState): string {
  return `${PHASE_LABELS[match.round.gamePhase]} — الجولة ${match.currentRound}/${match.totalRounds}`;
}

function buildReferenceImage(round: ImposterDrawRoundState) {
  return {
    id: round.imageId,
    label: round.imageLabel,
    imageUrl: round.imageUrl,
    categoryId: round.imageCategoryId,
  };
}

function buildRoundResultsInteractionView(
  match: ImposterDrawMatchState,
  shell: GameShellState,
  playerId: string,
): Pick<
  ImposterDrawPlayerView,
  | 'isHost'
  | 'canContinueFromRoundResults'
  | 'roundResultsContinueLabel'
  | 'roundResultsWaitingMessage'
> {
  const isHost = shell.hostPlayerId === playerId;
  const isFinalRound = match.currentRound >= match.totalRounds;

  return {
    isHost,
    canContinueFromRoundResults: isHost,
    roundResultsContinueLabel: isHost
      ? isFinalRound
        ? 'عرض النتائج النهائية'
        : 'بدء الجولة التالية'
      : null,
    roundResultsWaitingMessage: !isHost
      ? isFinalRound
        ? 'بانتظار المضيف لعرض النتائج النهائية.'
        : 'بانتظار المضيف لبدء الجولة التالية.'
      : null,
  };
}

export function buildImposterDrawPlayerView(
  match: ImposterDrawMatchState,
  playerId: string,
  shell: GameShellState,
): ImposterDrawPlayerView {
  const round = match.round;
  const isImpostor = playerId === round.impostorPlayerId;
  const isDrawingTurns = round.gamePhase === 'drawing-turns';
  const currentDrawerPlayerId = isDrawingTurns
    ? (round.drawingOrder[round.currentDrawerIndex] ?? null)
    : null;
  const revealSecrets =
    round.gamePhase === 'reveal' ||
    round.gamePhase === 'impostor-guess' ||
    round.gamePhase === 'round-results' ||
    round.gamePhase === 'match-completed';
  const showReferenceToCrew =
    !isImpostor &&
    (isDrawingTurns || round.gamePhase === 'voting');

  const connectedVoters = getConnectedParticipantIds(shell, match);
  const referenceImage = showReferenceToCrew ? buildReferenceImage(round) : null;

  const baseView: ImposterDrawPlayerView = {
    gamePhase: round.gamePhase,
    phaseLabel: buildRoundPhaseLabel(match),
    phaseRemainingSeconds: round.phaseRemainingSeconds,
    role: isImpostor ? 'impostor' : 'crew',
    referenceImage,
    currentDrawerPlayerId,
    currentDrawerName: currentDrawerPlayerId
      ? (match.playerNames[currentDrawerPlayerId] ?? 'لاعب')
      : null,
    canDraw: Boolean(isDrawingTurns && currentDrawerPlayerId === playerId),
    strokes: round.strokes,
    drawingOrder: round.drawingOrder,
    currentRound: match.currentRound,
    totalRounds: match.totalRounds,
    matchStatus: match.matchStatus,
    hasVoted: round.submittedVoterIds.includes(playerId),
    votablePlayers: match.playerIds
      .filter((candidateId) => candidateId !== playerId)
      .map((candidateId) => ({
        playerId: candidateId,
        name: match.playerNames[candidateId] ?? 'لاعب',
      })),
    submittedVotesCount: round.submittedVoterIds.length,
    eligibleVotersCount: connectedVoters.length,
    confirmedVoteTargetPlayerId: round.votes[playerId] ?? null,
    revealedImage: revealSecrets ? buildReferenceImage(round) : null,
    revealedImpostorPlayerId: revealSecrets ? round.impostorPlayerId : null,
    revealedImpostorName: revealSecrets
      ? (match.playerNames[round.impostorPlayerId] ?? 'لاعب')
      : null,
    impostorVotedOut: revealSecrets ? round.impostorVotedOut : null,
    voteTally: revealSecrets ? buildVoteTally(match) : [],
    impostorGuessOptions: round.gamePhase === 'impostor-guess' ? round.impostorGuessOptions : [],
    canGuessImage: round.gamePhase === 'impostor-guess' && isImpostor && round.selectedImageGuess === null,
    hasSubmittedImageGuess: round.selectedImageGuess !== null,
    selectedImageGuess:
      round.gamePhase === 'impostor-guess' ||
      round.gamePhase === 'round-results' ||
      round.gamePhase === 'match-completed'
        ? round.selectedImageGuess
        : null,
    impostorGuessedCorrectly:
      round.gamePhase === 'round-results' || round.gamePhase === 'match-completed'
        ? round.impostorGuessedCorrectly
        : null,
    playersWon:
      round.gamePhase === 'round-results' || round.gamePhase === 'match-completed'
        ? didPlayersWin(match)
        : null,
    roundResults: [],
    leaderboard: buildLeaderboardEntries(match),
    resultsLeaderboard: [],
    isHost: shell.hostPlayerId === playerId,
    canContinueFromRoundResults: false,
    roundResultsContinueLabel: null,
    roundResultsWaitingMessage: null,
  };

  if (round.gamePhase === 'round-results') {
    return {
      ...baseView,
      roundResults: buildRoundResultEntries(match),
      resultsLeaderboard: buildResultsLeaderboardEntries(match),
      ...buildRoundResultsInteractionView(match, shell, playerId),
    };
  }

  if (round.gamePhase === 'match-completed') {
    return {
      ...baseView,
      roundResults: [],
      resultsLeaderboard: buildResultsLeaderboardEntries(match),
    };
  }

  return baseView;
}
