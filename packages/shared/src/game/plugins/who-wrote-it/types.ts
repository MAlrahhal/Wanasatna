import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const WHO_WROTE_IT_GAME_ID = 'who-wrote-it' as const;

export const WHO_WROTE_IT_DEFAULT_ROUNDS = 4;
export const WHO_WROTE_IT_MAX_ANSWER_LENGTH = 150;
export const WHO_WROTE_IT_POINTS_PER_CORRECT = 100;

export type WhoWroteItGamePhase =
  | 'answering'
  | 'guessing'
  | 'round-results'
  | 'match-completed';

export type WhoWroteItAnswerRecord = {
  answerId: string;
  ownerPlayerId: string;
  text: string;
};

export type WhoWroteItRoundState = {
  gamePhase: WhoWroteItGamePhase;
  phaseRemainingSeconds: number;
  questionId: string;
  question: string;
  categoryId: string;
  /** Server-only owner mapping until reveal/results. */
  answers: WhoWroteItAnswerRecord[];
  /** Authoritative anonymous order — empty until guessing starts. */
  shuffledAnswerIds: string[];
  /** Global index into shuffledAnswerIds — all clients share this. */
  currentAnswerIndex: number;
  /** playerId → answerId → guessedOwnerPlayerId */
  guessesByPlayerId: Record<string, Record<string, string>>;
};

export type WhoWroteItMatchState = {
  playerIds: string[];
  playerNames: Record<string, string>;
  currentRound: number;
  totalRounds: number;
  scores: Record<string, number>;
  matchStatus: 'in-progress' | 'completed';
  recentQuestionIds: string[];
  round: WhoWroteItRoundState;
};

export type WhoWroteItAnonymousAnswer = {
  answerId: string;
  text: string;
};

export type WhoWroteItRevealEntry = {
  answerId: string;
  text: string;
  ownerPlayerId: string;
  ownerName: string;
  guessedOwnerPlayerId: string | null;
  guessedOwnerName: string | null;
  isCorrect: boolean;
};

export type WhoWroteItRoundResultEntry = {
  playerId: string;
  name: string;
  correctCount: number;
  /** Answers this player was asked to identify (excludes own). */
  guessTotal: number;
  roundPoints: number;
  totalPoints: number;
};

export type WhoWroteItLeaderboardEntry = {
  playerId: string;
  name: string;
  score: number;
};

export type WhoWroteItPlayerOption = {
  playerId: string;
  name: string;
};

export type WhoWroteItPlayerView = {
  gamePhase: WhoWroteItGamePhase;
  phaseLabel: string;
  phaseRemainingSeconds: number;
  question: string | null;
  categoryId: string | null;
  nextCategoryId: string | null;
  currentRound: number;
  totalRounds: number;
  matchStatus: 'in-progress' | 'completed';
  canSubmitAnswer: boolean;
  hasSubmittedAnswer: boolean;
  submittedAnswerCount: number;
  totalAnswerSlots: number;
  currentAnonymousAnswer: WhoWroteItAnonymousAnswer | null;
  /** True when the global current answer belongs to this player. */
  isOwnAnswer: boolean;
  hasGuessedCurrentAnswer: boolean;
  canSubmitGuess: boolean;
  guessingProgressIndex: number;
  guessingProgressTotal: number;
  currentAnswerGuessCount: number;
  currentAnswerRequiredGuessCount: number;
  guessOptions: WhoWroteItPlayerOption[];
  revealEntries: WhoWroteItRevealEntry[];
  roundResults: WhoWroteItRoundResultEntry[];
  leaderboard: WhoWroteItLeaderboardEntry[];
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

export const WHO_WROTE_IT_SYNC_EVENT = pluginActionEvent(WHO_WROTE_IT_GAME_ID, 'sync');
export const WHO_WROTE_IT_PHASE_CHANGED_EVENT = pluginActionEvent(
  WHO_WROTE_IT_GAME_ID,
  'phase-changed',
);
export const WHO_WROTE_IT_SUBMIT_ANSWER_EVENT = pluginActionEvent(
  WHO_WROTE_IT_GAME_ID,
  'submit-answer',
);
export const WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT = pluginActionEvent(
  WHO_WROTE_IT_GAME_ID,
  'submit-owner-guess',
);
export const WHO_WROTE_IT_CONTINUE_ROUND_RESULTS_EVENT = pluginActionEvent(
  WHO_WROTE_IT_GAME_ID,
  'continue-round-results',
);
export const WHO_WROTE_IT_SET_CATEGORY_EVENT = pluginActionEvent(
  WHO_WROTE_IT_GAME_ID,
  'set-category',
);
export const WHO_WROTE_IT_STATE_EVENT = pluginStateEvent(WHO_WROTE_IT_GAME_ID);

export type WhoWroteItSubmitAnswerPayload = {
  answer: string;
};

export type WhoWroteItSubmitOwnerGuessPayload = {
  answerId: string;
  ownerPlayerId: string;
};

export type WhoWroteItSetCategoryPayload = {
  categoryId: string | null;
};
