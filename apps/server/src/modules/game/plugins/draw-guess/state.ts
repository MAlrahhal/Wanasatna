import type {
  DrawGuessMatchState,
  DrawGuessPlayerView,
  DrawGuessRoundState,
  GameContentSettings,
  GameShellPlayer,
  GameShellState,
} from '@wanasatna/shared';
import {
  DRAW_GUESS_DEFAULT_DRAW_SECONDS,
  DRAW_GUESS_DEFAULT_ROUNDS,
} from '@wanasatna/shared';
import {
  resolveDescriptionDurationSeconds,
  resolveMatchRounds,
} from '../../../../config/test-timers.js';
import {
  buildLeaderboardEntries,
  buildResultsLeaderboardEntries,
  buildRoundResultEntries,
} from './scoring.js';
import { pickDrawGuessWord } from './words.js';

const PHASE_LABELS = {
  drawing: 'مرحلة الرسم',
  'round-results': 'نتيجة الجولة',
  'match-completed': 'انتهت المباراة',
} as const;

export function resolveTotalRounds(settings: GameContentSettings): number {
  return resolveMatchRounds(settings.rounds, DRAW_GUESS_DEFAULT_ROUNDS);
}

export function resolveDrawingDurationSeconds(settings: GameContentSettings): number {
  return resolveDescriptionDurationSeconds(
    settings.roundTime ?? DRAW_GUESS_DEFAULT_DRAW_SECONDS,
  );
}

export function createInitialScores(playerIds: string[]): Record<string, number> {
  return Object.fromEntries(playerIds.map((playerId) => [playerId, 0]));
}

export function withRound(
  match: DrawGuessMatchState,
  round: DrawGuessRoundState,
): DrawGuessMatchState {
  return {
    ...match,
    round,
  };
}

export function pickDrawerPlayerId(playerIds: string[], roundNumber: number): string {
  if (playerIds.length === 0) {
    throw new Error('No players available to pick a drawer.');
  }

  const index = (Math.max(1, roundNumber) - 1) % playerIds.length;
  return playerIds[index]!;
}

export function createRoundState(
  roomId: string,
  playerIds: string[],
  settings: GameContentSettings,
  roundNumber: number,
): DrawGuessRoundState {
  const wordEntry = pickDrawGuessWord(roomId);
  const drawingDurationSeconds = resolveDrawingDurationSeconds(settings);

  return {
    word: wordEntry.text,
    wordCategoryId: wordEntry.categoryId,
    drawerPlayerId: pickDrawerPlayerId(playerIds, roundNumber),
    gamePhase: 'drawing',
    phaseRemainingSeconds: drawingDurationSeconds,
    drawingDurationSeconds,
    strokes: [],
    correctGuesserPlayerId: null,
    guessedCorrectly: false,
  };
}

export function createMatchState(
  roomId: string,
  players: GameShellPlayer[],
  settings: GameContentSettings,
): DrawGuessMatchState {
  if (players.length === 0) {
    throw new Error('No players available for Draw & Guess match.');
  }

  const playerIds = players.map((player) => player.id);

  return {
    playerIds,
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    currentRound: 1,
    totalRounds: resolveTotalRounds(settings),
    scores: createInitialScores(playerIds),
    matchStatus: 'in-progress',
    round: createRoundState(roomId, playerIds, settings, 1),
  };
}

function buildRoundPhaseLabel(match: DrawGuessMatchState): string {
  return `${PHASE_LABELS[match.round.gamePhase]} — الجولة ${match.currentRound}/${match.totalRounds}`;
}

function buildRoundResultsInteractionView(
  match: DrawGuessMatchState,
  shell: GameShellState,
  playerId: string,
): Pick<
  DrawGuessPlayerView,
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

export function getConnectedParticipantIds(
  shell: GameShellState,
  match: DrawGuessMatchState,
): string[] {
  const participantIds = new Set(match.playerIds);

  return shell.players
    .filter((player) => player.isConnected && participantIds.has(player.id))
    .map((player) => player.id);
}

export function buildDrawGuessPlayerView(
  match: DrawGuessMatchState,
  playerId: string,
  shell: GameShellState,
): DrawGuessPlayerView {
  const round = match.round;
  const isDrawer = playerId === round.drawerPlayerId;
  const isDrawingPhase = round.gamePhase === 'drawing';
  const revealWord =
    round.gamePhase === 'round-results' || round.gamePhase === 'match-completed';

  const baseView: DrawGuessPlayerView = {
    gamePhase: round.gamePhase,
    phaseLabel: buildRoundPhaseLabel(match),
    phaseRemainingSeconds: round.phaseRemainingSeconds,
    role: isDrawer ? 'drawer' : 'guesser',
    secretWord: isDrawer && isDrawingPhase ? round.word : null,
    drawerPlayerId: round.drawerPlayerId,
    drawerName: match.playerNames[round.drawerPlayerId] ?? 'لاعب',
    strokes: round.strokes,
    currentRound: match.currentRound,
    totalRounds: match.totalRounds,
    matchStatus: match.matchStatus,
    revealedWord: revealWord ? round.word : null,
    correctGuesserPlayerId: revealWord ? round.correctGuesserPlayerId : null,
    correctGuesserName:
      revealWord && round.correctGuesserPlayerId
        ? (match.playerNames[round.correctGuesserPlayerId] ?? 'لاعب')
        : null,
    guessedCorrectly: revealWord ? round.guessedCorrectly : false,
    roundResults: [],
    leaderboard: [],
    resultsLeaderboard: [],
    isHost: shell.hostPlayerId === playerId,
    canContinueFromRoundResults: false,
    roundResultsContinueLabel: null,
    roundResultsWaitingMessage: null,
    canGuess: isDrawingPhase && !isDrawer && !round.guessedCorrectly,
  };

  if (round.gamePhase === 'round-results') {
    return {
      ...baseView,
      roundResults: buildRoundResultEntries(match),
      resultsLeaderboard: buildResultsLeaderboardEntries(match),
      leaderboard: buildLeaderboardEntries(match),
      ...buildRoundResultsInteractionView(match, shell, playerId),
    };
  }

  if (round.gamePhase === 'match-completed') {
    return {
      ...baseView,
      roundResults: [],
      resultsLeaderboard: buildResultsLeaderboardEntries(match),
      leaderboard: buildLeaderboardEntries(match),
      canContinueFromRoundResults: false,
      roundResultsContinueLabel: null,
      roundResultsWaitingMessage: null,
    };
  }

  return baseView;
}
