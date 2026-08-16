import type {
  DrawGuessDrawerMode,
  DrawGuessMatchState,
  DrawGuessPlayerView,
  DrawGuessRoundState,
  GameContentSettings,
  GameShellPlayer,
  GameShellState,
} from '@wanasatna/shared';
import {
  DRAW_GUESS_DEFAULT_ROUNDS,
  MATCH_COMPLETED_RETURN_TO_LOBBY_LABEL,
  MATCH_COMPLETED_WAITING_MESSAGE,
  buildRoundResultsContinueCopy,
} from '@wanasatna/shared';
import { randomUUID } from 'node:crypto';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { remainingSecondsFromDeadline, timedPhaseClock } from '../../runtime/phase-deadline.js';
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

/** Product rule: exactly 3 rounds (not collapsed in test mode). */
export function resolveTotalRounds(_settings?: GameContentSettings): number {
  return DRAW_GUESS_DEFAULT_ROUNDS;
}

export function resolveDrawingDurationSeconds(): number {
  return timedPhaseDurations.drawGuessDrawing();
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

export function pickRandomDrawerPlayerId(playerIds: readonly string[]): string {
  if (playerIds.length === 0) {
    throw new Error('No players available to pick a drawer.');
  }

  const index = Math.floor(Math.random() * playerIds.length);
  return playerIds[index]!;
}

/**
 * Fixed-drawer fallback: if the chosen drawer is unavailable, use the first
 * connected participant in roster order (deterministic). If nobody is connected,
 * fall back to the first match roster id.
 */
export function resolveDrawerPlayerId(options: {
  drawerMode: DrawGuessDrawerMode;
  fixedDrawerPlayerId: string | null;
  playerIds: readonly string[];
  connectedPlayerIds: readonly string[];
}): string {
  const pool =
    options.connectedPlayerIds.length > 0 ? options.connectedPlayerIds : options.playerIds;

  if (pool.length === 0) {
    throw new Error('No players available to pick a drawer.');
  }

  if (options.drawerMode === 'fixed' && options.fixedDrawerPlayerId) {
    if (pool.includes(options.fixedDrawerPlayerId)) {
      return options.fixedDrawerPlayerId;
    }

    return pool[0]!;
  }

  return pickRandomDrawerPlayerId(pool);
}

export function createRoundState(
  roomId: string,
  match: Pick<
    DrawGuessMatchState,
    'playerIds' | 'drawerMode' | 'fixedDrawerPlayerId' | 'usedWordTexts'
  >,
  _roundNumber: number,
  connectedPlayerIds: readonly string[],
): { round: DrawGuessRoundState; usedWordTexts: string[] } {
  const wordEntry = pickDrawGuessWord(roomId, match.usedWordTexts);
  const drawingDurationSeconds = resolveDrawingDurationSeconds();
  const drawerPlayerId = resolveDrawerPlayerId({
    drawerMode: match.drawerMode,
    fixedDrawerPlayerId: match.fixedDrawerPlayerId,
    playerIds: match.playerIds,
    connectedPlayerIds,
  });

  return {
    round: {
      turnId: randomUUID(),
      word: wordEntry.text,
      wordCategoryId: wordEntry.categoryId,
      drawerPlayerId,
      gamePhase: 'drawing',
      ...timedPhaseClock(drawingDurationSeconds),
      drawingDurationSeconds,
      strokes: [],
      correctGuesserPlayerId: null,
      guessedCorrectly: false,
    },
    usedWordTexts: [...match.usedWordTexts, wordEntry.text],
  };
}

export function createMatchState(
  roomId: string,
  players: GameShellPlayer[],
  settings: GameContentSettings,
  drawerMode: DrawGuessDrawerMode = 'random',
  fixedDrawerPlayerId: string | null = null,
): DrawGuessMatchState {
  if (players.length === 0) {
    throw new Error('No players available for Draw & Guess match.');
  }

  const playerIds = players.map((player) => player.id);
  const connectedPlayerIds = players.filter((player) => player.isConnected).map((p) => p.id);
  const base = {
    playerIds,
    drawerMode,
    fixedDrawerPlayerId:
      drawerMode === 'fixed' && fixedDrawerPlayerId && playerIds.includes(fixedDrawerPlayerId)
        ? fixedDrawerPlayerId
        : null,
    usedWordTexts: [] as string[],
  };
  const { round, usedWordTexts } = createRoundState(roomId, base, 1, connectedPlayerIds);

  return {
    playerIds,
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    currentRound: 1,
    totalRounds: resolveTotalRounds(settings),
    scores: createInitialScores(playerIds),
    matchStatus: 'in-progress',
    drawerMode: base.drawerMode,
    fixedDrawerPlayerId: base.fixedDrawerPlayerId,
    usedWordTexts,
    round,
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

  return buildRoundResultsContinueCopy({ isFinalRound, isHost });
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

const EMPTY_RESULTS = {
  roundResults: [] as DrawGuessPlayerView['roundResults'],
  leaderboard: [] as DrawGuessPlayerView['leaderboard'],
  resultsLeaderboard: [] as DrawGuessPlayerView['resultsLeaderboard'],
  isHost: false,
  canContinueFromRoundResults: false,
  roundResultsContinueLabel: null,
  roundResultsWaitingMessage: null,
  canGuess: false,
  isMatchSpectator: false,
};

export function buildDrawGuessSpectatorView(match: DrawGuessMatchState): DrawGuessPlayerView {
  const round = match.round;
  const revealWord =
    round.gamePhase === 'round-results' || round.gamePhase === 'match-completed';

  return {
    gamePhase: round.gamePhase,
    phaseLabel: 'الجولة جارية',
    phaseRemainingSeconds: round.deadlineAtMs
      ? remainingSecondsFromDeadline(round.deadlineAtMs)
      : round.phaseRemainingSeconds,
    deadlineAtMs: round.deadlineAtMs,
    role: 'guesser',
    secretWord: null,
    turnId: round.turnId,
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
    ...EMPTY_RESULTS,
    isMatchSpectator: true,
    leaderboard: buildLeaderboardEntries(match),
  };
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
    phaseRemainingSeconds: round.deadlineAtMs
      ? remainingSecondsFromDeadline(round.deadlineAtMs)
      : round.phaseRemainingSeconds,
    deadlineAtMs: round.deadlineAtMs,
    role: isDrawer ? 'drawer' : 'guesser',
    secretWord: isDrawer && isDrawingPhase ? round.word : null,
    turnId: round.turnId,
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
    leaderboard: buildLeaderboardEntries(match),
    resultsLeaderboard: [],
    isHost: shell.hostPlayerId === playerId,
    canContinueFromRoundResults: false,
    roundResultsContinueLabel: null,
    roundResultsWaitingMessage: null,
    canGuess: isDrawingPhase && !isDrawer && !round.guessedCorrectly,
    isMatchSpectator: false,
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
    const isHost = shell.hostPlayerId === playerId;

    return {
      ...baseView,
      roundResults: [],
      resultsLeaderboard: buildResultsLeaderboardEntries(match),
      leaderboard: buildLeaderboardEntries(match),
      isHost,
      canContinueFromRoundResults: isHost,
      roundResultsContinueLabel: isHost ? MATCH_COMPLETED_RETURN_TO_LOBBY_LABEL : null,
      roundResultsWaitingMessage: MATCH_COMPLETED_WAITING_MESSAGE,
    };
  }

  return baseView;
}

/** Sanitize match payloads so secret words are never serialized for clients. */
export function serializeDrawGuessState(state: DrawGuessMatchState): DrawGuessMatchState {
  return {
    ...state,
    round: {
      ...state.round,
      word: '',
    },
  };
}
