import type {
  BaraAlSalafaMatchState,
  BaraAlSalafaRoundState,
  GameContentBundle,
  GameContentSettings,
  GameShellPlayer,
} from '@wanasatna/shared';
import {
  BARA_AL_SALAFA_DEFAULT_ROUNDS,
  pickRandomWordFromCategories,
} from '@wanasatna/shared';
import {
  resolveDescriptionDurationSeconds,
  resolveMatchRounds,
  resolveQuestionTurnDurationSeconds,
  timedPhaseDurations,
} from '../../../../config/test-timers.js';

const DEFAULT_QUESTION_TURN_SECONDS = 45;
const MIN_QUESTION_TURN_SECONDS = 30;
const MAX_QUESTION_TURN_SECONDS = 90;

export function resolveTotalRounds(settings: GameContentSettings): number {
  return resolveMatchRounds(settings.rounds, BARA_AL_SALAFA_DEFAULT_ROUNDS);
}

function resolveQuestionTurnDuration(
  settings: GameContentSettings,
  playerCount: number,
): number {
  const baseDuration = settings.roundTime ?? DEFAULT_QUESTION_TURN_SECONDS;
  const scaledDuration = Math.floor(baseDuration / Math.max(playerCount, 1));

  return Math.min(
    MAX_QUESTION_TURN_SECONDS,
    Math.max(MIN_QUESTION_TURN_SECONDS, scaledDuration),
  );
}

export function createInitialScores(playerIds: string[]): Record<string, number> {
  return Object.fromEntries(playerIds.map((playerId) => [playerId, 0]));
}

export function ensureScoresForPlayers(
  scores: Record<string, number>,
  playerIds: string[],
): Record<string, number> {
  const nextScores = { ...scores };

  for (const playerId of playerIds) {
    if (!(playerId in nextScores)) {
      nextScores[playerId] = 0;
    }
  }

  return nextScores;
}

export function createRoundState(
  players: GameShellPlayer[],
  bundle: GameContentBundle,
  settings: GameContentSettings,
  enabledCategoryIds?: string[],
): BaraAlSalafaRoundState {
  const eligiblePlayers = players.filter((player) => player.isConnected);

  if (eligiblePlayers.length === 0) {
    throw new Error('No connected players available.');
  }

  const wordEntry = pickRandomWordFromCategories(
    bundle,
    enabledCategoryIds ?? settings.enabledCategories,
  );

  if (!wordEntry) {
    throw new Error('No words available for the selected categories.');
  }

  const impostorIndex = Math.floor(Math.random() * eligiblePlayers.length);
  const impostor = eligiblePlayers[impostorIndex]!;
  const descriptionDurationSeconds = resolveDescriptionDurationSeconds(settings.roundTime);
  const questionTurnDurationSeconds = resolveQuestionTurnDurationSeconds(
    resolveQuestionTurnDuration(settings, eligiblePlayers.length),
  );

  return {
    word: wordEntry.text,
    wordCategoryId: wordEntry.categoryId,
    impostorPlayerId: impostor.id,
    gamePhase: 'description',
    phaseRemainingSeconds: descriptionDurationSeconds,
    descriptionDurationSeconds,
    questionTurnDurationSeconds,
    speakingOrder: [],
    directedQuestionPairs: [],
    currentSpeakerIndex: 0,
    activeFreeQuestionPlayerId: null,
    pendingFreeQuestionTargetPlayerId: null,
    completedFreeQuestionTurns: [],
    roleUnderstoodPlayerIds: [],
    votes: {},
    submittedVoterIds: [],
    votingDurationSeconds: timedPhaseDurations.voting(),
    revealDurationSeconds: timedPhaseDurations.reveal(),
    impostorGuessOptions: [],
    impostorGuessDurationSeconds: timedPhaseDurations.impostorGuess(),
    selectedWord: null,
    guessedCorrectly: null,
  };
}

export function createMatchState(
  players: GameShellPlayer[],
  bundle: GameContentBundle,
  settings: GameContentSettings,
  enabledCategoryIds?: string[],
): BaraAlSalafaMatchState {
  const eligiblePlayers = players.filter((player) => player.isConnected);
  const playerIds = eligiblePlayers.map((player) => player.id);

  return {
    playerIds,
    playerNames: Object.fromEntries(
      eligiblePlayers.map((player) => [player.id, player.name]),
    ),
    currentRound: 1,
    totalRounds: resolveTotalRounds(settings),
    scores: createInitialScores(playerIds),
    matchStatus: 'in-progress',
    round: createRoundState(eligiblePlayers, bundle, settings, enabledCategoryIds),
  };
}

export function withRound(
  match: BaraAlSalafaMatchState,
  round: BaraAlSalafaRoundState,
): BaraAlSalafaMatchState {
  return {
    ...match,
    round,
  };
}

export function syncMatchPlayersFromShell(
  match: BaraAlSalafaMatchState,
  players: GameShellPlayer[],
): BaraAlSalafaMatchState {
  const participantIds = new Set(match.playerIds);
  const connectedParticipants = players.filter(
    (player) => player.isConnected && participantIds.has(player.id),
  );

  const playerIds = connectedParticipants.map((player) => player.id);

  return {
    ...match,
    playerIds,
    playerNames: Object.fromEntries(
      connectedParticipants.map((player) => [player.id, player.name]),
    ),
    scores: ensureScoresForPlayers(match.scores, playerIds),
  };
}
