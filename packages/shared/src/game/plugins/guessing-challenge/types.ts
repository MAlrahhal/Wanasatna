import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const GUESSING_CHALLENGE_GAME_ID = 'guessing-challenge' as const;

export const GUESSING_CHALLENGE_DEFAULT_ROUNDS = 4;
export const GUESSING_CHALLENGE_MAX_GUESS_LENGTH = 80;
export const GUESSING_CHALLENGE_WINNER_POINTS = 100;
export const GUESSING_CHALLENGE_YELLOW_QUESTIONS = 3;

export type GuessingChallengeGamePhase = 'playing' | 'round-results' | 'match-completed';

/** Future-ready identity media type. v1 uses text only. */
export type GuessingChallengeIdentityType = 'text' | 'image';

/** Server-only secret identity. Never send acceptedAnswers / own value pre-reveal. */
export type GuessingChallengeIdentitySecret = {
  id: string;
  categoryId: string;
  type: GuessingChallengeIdentityType;
  value: string;
  imageUrl: string | null;
  acceptedAnswers: string[];
};

export type GuessingChallengeVisibleIdentity = {
  type: GuessingChallengeIdentityType;
  value: string | null;
  imageUrl: string | null;
};

export type GuessingChallengePlayerCards = {
  yellowUsed: boolean;
  redUsed: boolean;
};

export type GuessingChallengeRoundState = {
  gamePhase: GuessingChallengeGamePhase;
  phaseRemainingSeconds: number;
  resolvedCategoryId: string;
  /** Server-only map of playerId → secret identity. */
  identitiesByPlayerId: Record<string, GuessingChallengeIdentitySecret>;
  usedIdentityIds: string[];
  currentTurnPlayerId: string;
  startingPlayerId: string;
  cardsByPlayerId: Record<string, GuessingChallengePlayerCards>;
  /** Remaining questions in active yellow sequence; null when inactive. */
  yellowQuestionsRemaining: number | null;
  winningPlayerId: string | null;
  winningGuess: string | null;
  identityChangedNoticePlayerId: string | null;
};

export type GuessingChallengeMatchState = {
  playerIds: string[];
  playerNames: Record<string, string>;
  currentRound: number;
  totalRounds: number;
  scores: Record<string, number>;
  matchStatus: 'in-progress' | 'completed';
  /** Alternating starter index into playerIds. */
  nextStartingPlayerIndex: number;
  recentIdentityIds: string[];
  round: GuessingChallengeRoundState;
};

export type GuessingChallengeRevealEntry = {
  playerId: string;
  name: string;
  identity: GuessingChallengeVisibleIdentity;
  isWinner: boolean;
};

export type GuessingChallengeRoundResultEntry = {
  playerId: string;
  name: string;
  roundPoints: number;
  totalPoints: number;
  isWinner: boolean;
};

export type GuessingChallengeLeaderboardEntry = {
  playerId: string;
  name: string;
  score: number;
};

export type GuessingChallengePlayerView = {
  gamePhase: GuessingChallengeGamePhase;
  phaseLabel: string;
  phaseRemainingSeconds: number;
  categoryId: string | null;
  nextCategoryId: string | null;
  currentRound: number;
  totalRounds: number;
  matchStatus: 'in-progress' | 'completed';
  currentTurnPlayerId: string | null;
  currentTurnPlayerName: string | null;
  isMyTurn: boolean;
  turnInstruction: string | null;
  self: {
    playerId: string;
    name: string;
    identityHidden: true;
    /** Revealed only after round ends. */
    revealedIdentity: GuessingChallengeVisibleIdentity | null;
    yellowCardAvailable: boolean;
    redCardAvailable: boolean;
  };
  opponent: {
    playerId: string;
    name: string;
    visibleIdentity: GuessingChallengeVisibleIdentity | null;
  };
  yellowQuestionsRemaining: number | null;
  canEndQuestion: boolean;
  canGuess: boolean;
  canUseYellow: boolean;
  canUseRed: boolean;
  identityChangedNotice: boolean;
  revealEntries: GuessingChallengeRevealEntry[];
  winnerName: string | null;
  winningGuess: string | null;
  roundResults: GuessingChallengeRoundResultEntry[];
  leaderboard: GuessingChallengeLeaderboardEntry[];
  resultsLeaderboard: Array<{
    playerId: string;
    name: string;
    totalPoints: number;
    rank: number;
    isFirstPlace: boolean;
  }>;
  isHost: boolean;
  canContinueFromRoundResults: boolean;
  roundResultsContinueLabel: string | null;
  roundResultsWaitingMessage: string | null;
};

export const GUESSING_CHALLENGE_SYNC_EVENT = pluginActionEvent(
  GUESSING_CHALLENGE_GAME_ID,
  'sync',
);
export const GUESSING_CHALLENGE_PHASE_CHANGED_EVENT = pluginActionEvent(
  GUESSING_CHALLENGE_GAME_ID,
  'phase-changed',
);
export const GUESSING_CHALLENGE_END_QUESTION_EVENT = pluginActionEvent(
  GUESSING_CHALLENGE_GAME_ID,
  'end-question',
);
export const GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT = pluginActionEvent(
  GUESSING_CHALLENGE_GAME_ID,
  'submit-final-guess',
);
export const GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT = pluginActionEvent(
  GUESSING_CHALLENGE_GAME_ID,
  'use-yellow-card',
);
export const GUESSING_CHALLENGE_USE_RED_CARD_EVENT = pluginActionEvent(
  GUESSING_CHALLENGE_GAME_ID,
  'use-red-card',
);
export const GUESSING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT = pluginActionEvent(
  GUESSING_CHALLENGE_GAME_ID,
  'continue-round-results',
);
export const GUESSING_CHALLENGE_SET_CATEGORY_EVENT = pluginActionEvent(
  GUESSING_CHALLENGE_GAME_ID,
  'set-category',
);
export const GUESSING_CHALLENGE_STATE_EVENT = pluginStateEvent(GUESSING_CHALLENGE_GAME_ID);

export type GuessingChallengeSubmitFinalGuessPayload = {
  guess: string;
};

export type GuessingChallengeSetCategoryPayload = {
  categoryId: string | null;
};
