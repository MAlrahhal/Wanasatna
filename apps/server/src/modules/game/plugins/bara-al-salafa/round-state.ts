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

export function resolveTotalRounds(_settings?: GameContentSettings): number {
  return resolveMatchRounds(BARA_AL_SALAFA_DEFAULT_ROUNDS, BARA_AL_SALAFA_DEFAULT_ROUNDS);
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

function resolveCategoryName(bundle: GameContentBundle, categoryId: string): string {
  return bundle.categories.find((category) => category.id === categoryId)?.name ?? categoryId;
}

export function createRoundState(
  players: GameShellPlayer[],
  bundle: GameContentBundle,
  settings: GameContentSettings,
  enabledCategoryIds?: string[],
  usedWordTexts: readonly string[] = [],
): BaraAlSalafaRoundState {
  const eligiblePlayers = players.filter((player) => player.isConnected);

  if (eligiblePlayers.length === 0) {
    throw new Error('No connected players available.');
  }

  const wordEntry = pickRandomWordFromCategories(
    bundle,
    enabledCategoryIds ?? settings.enabledCategories,
    usedWordTexts,
  );

  if (!wordEntry) {
    throw new Error('No words available for the selected categories.');
  }

  const impostorIndex = Math.floor(Math.random() * eligiblePlayers.length);
  const impostor = eligiblePlayers[impostorIndex]!;
  const descriptionDurationSeconds = resolveDescriptionDurationSeconds();
  const questionTurnDurationSeconds = resolveQuestionTurnDurationSeconds();

  return {
    word: wordEntry.text,
    wordCategoryId: wordEntry.categoryId,
    categoryName: resolveCategoryName(bundle, wordEntry.categoryId),
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
    roundResultsDurationSeconds: timedPhaseDurations.roundResults(),
    guessResultDurationSeconds: timedPhaseDurations.guessResult(),
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
  const round = createRoundState(eligiblePlayers, bundle, settings, enabledCategoryIds, []);

  return {
    playerIds,
    playerNames: Object.fromEntries(
      eligiblePlayers.map((player) => [player.id, player.name]),
    ),
    currentRound: 1,
    totalRounds: resolveTotalRounds(settings),
    scores: createInitialScores(playerIds),
    matchStatus: 'in-progress',
    usedWordTexts: [round.word],
    round,
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
