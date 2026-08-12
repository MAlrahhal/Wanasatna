import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const WHO_WROTE_IT_GAME_ID = 'who-wrote-it' as const;

/** Production Free: exactly 3 rounds (not lobby-configurable). */
export const WHO_WROTE_IT_DEFAULT_ROUNDS = 3;
export const WHO_WROTE_IT_ANSWERING_SECONDS = 60;
export const WHO_WROTE_IT_GUESS_SECONDS = 30;
export const WHO_WROTE_IT_ROUND_RESULTS_SECONDS = 10;
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
  roundId: string;
  gamePhase: WhoWroteItGamePhase;
  phaseRemainingSeconds: number;
  deadlineAtMs: number | null;
  questionId: string;
  question: string;
  /** Internal prompt category for this round. */
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
  /** Lobby selection: specific category id, or `random`. */
  lockedCategoryId: string;
  /** Public header label — stays `عشوائي` for the whole match when random. */
  lockedCategoryLabel: string;
  /** Internal categories already used in this match (random mode only). */
  usedRoundCategoryIds: string[];
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
  deadlineAtMs: number | null;
  roundId: string | null;
  question: string | null;
  categoryId: string | null;
  categoryLabel: string | null;
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
  isMatchSpectator: boolean;
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
export const WHO_WROTE_IT_STATE_EVENT = pluginStateEvent(WHO_WROTE_IT_GAME_ID);

export type WhoWroteItSubmitAnswerPayload = {
  answer: string;
  roundId: string;
};

export type WhoWroteItSubmitOwnerGuessPayload = {
  answerId: string;
  ownerPlayerId: string;
  roundId: string;
};
