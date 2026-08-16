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
  buildRoundResultsContinueCopy,
  MATCH_COMPLETED_RETURN_TO_LOBBY_LABEL,
  MATCH_COMPLETED_WAITING_MESSAGE,
} from '@wanasatna/shared';
import { randomUUID } from 'node:crypto';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { remainingSecondsFromDeadline, timedPhaseClock } from '../../runtime/phase-deadline.js';
import { buildPlaceholderImageUrl, pickImposterDrawImage } from './images.js';
import {
  buildLeaderboardEntries,
  buildResultsLeaderboardEntries,
  buildRoundResultEntries,
  didPlayersWin,
} from './scoring.js';
import { getConnectedParticipantIds } from './voting.js';

export { getConnectedParticipantIds };

const PHASE_LABELS = {
  briefing: 'كشف الدور',
  'drawing-turns': 'دور الرسم',
  voting: 'التصويت',
  reveal: 'الكشف',
  'impostor-guess': 'تخمين الصورة',
  'guess-result': 'نتيجة التخمين',
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

export function resolveTotalRounds(_settings?: GameContentSettings): number {
  return IMPOSTER_DRAW_DEFAULT_ROUNDS;
}

export function resolveTurnDurationSeconds(): number {
  return timedPhaseDurations.imposterDrawTurn();
}

export function createInitialScores(playerIds: string[]): Record<string, number> {
  return Object.fromEntries(playerIds.map((playerId) => [playerId, 0]));
}

export function withRound(
  match: ImposterDrawMatchState,
  round: ImposterDrawRoundState,
): ImposterDrawMatchState {
  return { ...match, round };
}

export function pickImpostorPlayerId(
  playerIds: readonly string[],
  previousImpostorPlayerId: string | null,
): string {
  if (playerIds.length === 0) {
    throw new Error('No players available to pick an impostor.');
  }

  const alternatives =
    previousImpostorPlayerId && playerIds.length > 1
      ? playerIds.filter((id) => id !== previousImpostorPlayerId)
      : [...playerIds];

  const pool = alternatives.length > 0 ? alternatives : [...playerIds];
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function createRoundState(
  roomId: string,
  match: Pick<ImposterDrawMatchState, 'playerIds' | 'usedImageTexts' | 'previousImpostorPlayerId'>,
): { round: ImposterDrawRoundState; usedImageTexts: string[] } {
  const imageEntry = pickImposterDrawImage(roomId, match.usedImageTexts);
  const turnDurationSeconds = resolveTurnDurationSeconds();
  const drawingOrder = shufflePlayerIds([...match.playerIds]);
  const impostorPlayerId = pickImpostorPlayerId(
    match.playerIds,
    match.previousImpostorPlayerId,
  );

  return {
    round: {
      turnId: randomUUID(),
      imageId: imageEntry.id,
      imageLabel: imageEntry.text,
      imageUrl: buildPlaceholderImageUrl(imageEntry.text),
      imageCategoryId: imageEntry.categoryId,
      impostorPlayerId,
      drawingOrder,
      currentDrawerIndex: 0,
      currentTurnStrokeIds: [],
      turnDurationSeconds,
      gamePhase: 'briefing',
      ...timedPhaseClock(timedPhaseDurations.imposterDrawBriefing()),
      strokes: [],
      roleUnderstoodPlayerIds: [],
      votes: {},
      submittedVoterIds: [],
      impostorVotedOut: null,
      impostorGuessOptions: [],
      selectedImageGuess: null,
      impostorGuessedCorrectly: null,
      revealDurationSeconds: timedPhaseDurations.imposterDrawReveal(),
      guessDurationSeconds: timedPhaseDurations.imposterDrawGuess(),
    },
    usedImageTexts: [...match.usedImageTexts, imageEntry.text],
  };
}

export function createMatchState(
  roomId: string,
  players: GameShellPlayer[],
  _settings: GameContentSettings,
): ImposterDrawMatchState {
  if (players.length === 0) {
    throw new Error('No players available for Imposter Draw match.');
  }

  const playerIds = players.map((player) => player.id);
  const base = {
    playerIds,
    usedImageTexts: [] as string[],
    previousImpostorPlayerId: null as string | null,
  };
  const { round, usedImageTexts } = createRoundState(roomId, base);

  return {
    playerIds,
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    currentRound: 1,
    totalRounds: resolveTotalRounds(),
    scores: createInitialScores(playerIds),
    matchStatus: 'in-progress',
    usedImageTexts,
    previousImpostorPlayerId: null,
    round,
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

function visiblePhaseClock(round: ImposterDrawRoundState): {
  phaseRemainingSeconds: number;
  deadlineAtMs: number | null;
} {
  return {
    phaseRemainingSeconds: round.deadlineAtMs
      ? remainingSecondsFromDeadline(round.deadlineAtMs)
      : round.phaseRemainingSeconds,
    deadlineAtMs: round.deadlineAtMs,
  };
}

export function buildImposterDrawSpectatorView(match: ImposterDrawMatchState): ImposterDrawPlayerView {
  const round = match.round;
  const isDrawing = round.gamePhase === 'drawing-turns';
  const currentDrawerPlayerId = isDrawing
    ? (round.drawingOrder[round.currentDrawerIndex] ?? null)
    : null;
  const revealIdentity =
    round.gamePhase === 'reveal' ||
    round.gamePhase === 'impostor-guess' ||
    round.gamePhase === 'guess-result' ||
    round.gamePhase === 'round-results' ||
    round.gamePhase === 'match-completed';
  const revealAnswer =
    round.gamePhase === 'guess-result' ||
    round.gamePhase === 'round-results' ||
    round.gamePhase === 'match-completed';

  return {
    gamePhase: round.gamePhase,
    phaseLabel: 'الجولة جارية',
    ...visiblePhaseClock(round),
    role: 'crew',
    referenceImage: null,
    turnId: round.turnId,
    currentDrawerPlayerId,
    currentDrawerName: currentDrawerPlayerId
      ? (match.playerNames[currentDrawerPlayerId] ?? 'لاعب')
      : null,
    canDraw: false,
    strokes: round.strokes,
    drawingOrder: round.drawingOrder,
    currentRound: match.currentRound,
    totalRounds: match.totalRounds,
    matchStatus: match.matchStatus,
    hasAcknowledgedBriefing: false,
    briefingAckCount: 0,
    eligibleBriefingAckCount: 0,
    hasVoted: false,
    votablePlayers: [],
    submittedVotesCount: 0,
    eligibleVotersCount: 0,
    confirmedVoteTargetPlayerId: null,
    revealedImpostorPlayerId: revealIdentity ? round.impostorPlayerId : null,
    revealedImpostorName: revealIdentity
      ? (match.playerNames[round.impostorPlayerId] ?? 'لاعب')
      : null,
    impostorVotedOut: revealIdentity ? round.impostorVotedOut : null,
    impostorGuessOptions: [],
    canGuessImage: false,
    hasSubmittedImageGuess: false,
    selectedImageGuess: null,
    impostorGuessedCorrectly: revealAnswer ? round.impostorGuessedCorrectly : null,
    guessResultMessage: null,
    playersWon: null,
    roundResults: [],
    leaderboard: [],
    resultsLeaderboard: [],
    isHost: false,
    canContinueFromRoundResults: false,
    roundResultsContinueLabel: null,
    roundResultsWaitingMessage: null,
    isMatchSpectator: true,
    revealedAnswerLabel: revealAnswer ? round.imageLabel : null,
  };
}

export function buildImposterDrawPlayerView(
  match: ImposterDrawMatchState,
  playerId: string,
  shell: GameShellState,
): ImposterDrawPlayerView {
  const round = match.round;
  const isImpostor = playerId === round.impostorPlayerId;
  const isBriefing = round.gamePhase === 'briefing';
  const isDrawingTurns = round.gamePhase === 'drawing-turns';
  const currentDrawerPlayerId = isDrawingTurns
    ? (round.drawingOrder[round.currentDrawerIndex] ?? null)
    : null;
  const revealIdentity =
    round.gamePhase === 'reveal' ||
    round.gamePhase === 'impostor-guess' ||
    round.gamePhase === 'guess-result' ||
    round.gamePhase === 'round-results' ||
    round.gamePhase === 'match-completed';
  const revealAnswer =
    round.gamePhase === 'guess-result' ||
    round.gamePhase === 'round-results' ||
    round.gamePhase === 'match-completed';
  const connected = getConnectedParticipantIds(shell, match);

  const baseView: ImposterDrawPlayerView = {
    gamePhase: round.gamePhase,
    phaseLabel: buildRoundPhaseLabel(match),
    ...visiblePhaseClock(round),
    role: isImpostor ? 'impostor' : 'crew',
    referenceImage: isBriefing && !isImpostor ? buildReferenceImage(round) : null,
    turnId: round.turnId,
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
    hasAcknowledgedBriefing: round.roleUnderstoodPlayerIds.includes(playerId),
    briefingAckCount: round.roleUnderstoodPlayerIds.length,
    eligibleBriefingAckCount: connected.length,
    hasVoted: round.submittedVoterIds.includes(playerId),
    votablePlayers: match.playerIds
      .filter((candidateId) => candidateId !== playerId)
      .map((candidateId) => ({
        playerId: candidateId,
        name: match.playerNames[candidateId] ?? 'لاعب',
      })),
    submittedVotesCount: round.submittedVoterIds.length,
    eligibleVotersCount: connected.length,
    confirmedVoteTargetPlayerId: round.votes[playerId] ?? null,
    revealedImpostorPlayerId: revealIdentity ? round.impostorPlayerId : null,
    revealedImpostorName: revealIdentity
      ? (match.playerNames[round.impostorPlayerId] ?? 'لاعب')
      : null,
    impostorVotedOut: revealIdentity ? round.impostorVotedOut : null,
    impostorGuessOptions: round.gamePhase === 'impostor-guess' ? round.impostorGuessOptions : [],
    canGuessImage:
      round.gamePhase === 'impostor-guess' && isImpostor && round.selectedImageGuess === null,
    hasSubmittedImageGuess: round.selectedImageGuess !== null,
    selectedImageGuess: revealAnswer ? round.selectedImageGuess : null,
    impostorGuessedCorrectly: revealAnswer ? round.impostorGuessedCorrectly : null,
    guessResultMessage:
      round.gamePhase === 'guess-result'
        ? round.impostorGuessedCorrectly
          ? 'إجابة صحيحة!'
          : 'إجابة خاطئة!'
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
    isMatchSpectator: false,
    revealedAnswerLabel: revealAnswer ? round.imageLabel : null,
  };

  if (round.gamePhase === 'round-results') {
    return {
      ...baseView,
      roundResults: buildRoundResultEntries(match),
      resultsLeaderboard: buildResultsLeaderboardEntries(match),
      ...buildRoundResultsContinueCopy({
        isFinalRound: match.currentRound >= match.totalRounds,
        isHost: shell.hostPlayerId === playerId,
      }),
    };
  }

  if (round.gamePhase === 'match-completed') {
    const isHost = shell.hostPlayerId === playerId;
    return {
      ...baseView,
      resultsLeaderboard: buildResultsLeaderboardEntries(match),
      isHost,
      canContinueFromRoundResults: isHost,
      roundResultsContinueLabel: isHost ? MATCH_COMPLETED_RETURN_TO_LOBBY_LABEL : null,
      roundResultsWaitingMessage: MATCH_COMPLETED_WAITING_MESSAGE,
    };
  }

  return baseView;
}

/** Blank secrets if raw plugin state is ever serialized to clients. */
export function serializeImposterDrawState(state: ImposterDrawMatchState): ImposterDrawMatchState {
  return {
    ...state,
    round: {
      ...state.round,
      imageLabel: '',
      imageUrl: '',
      impostorPlayerId: '',
      impostorGuessOptions: [],
    },
  };
}
