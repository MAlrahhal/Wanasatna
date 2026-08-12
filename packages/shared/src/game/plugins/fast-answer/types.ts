import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const FAST_ANSWER_GAME_ID = 'fast-answer' as const;

/** Production Free: exactly 5 rounds (not lobby-configurable). */
export const FAST_ANSWER_DEFAULT_ROUNDS = 5;
/** Production question duration (server-authoritative). */
export const FAST_ANSWER_QUESTION_SECONDS = 15;
/** @deprecated Use FAST_ANSWER_QUESTION_SECONDS */
export const FAST_ANSWER_DEFAULT_ROUND_SECONDS = FAST_ANSWER_QUESTION_SECONDS;
export const FAST_ANSWER_ROUND_RESULTS_SECONDS = 10;
export const FAST_ANSWER_WINNER_POINTS = 100;

export type FastAnswerGamePhase = 'question' | 'round-results' | 'match-completed';

export type FastAnswerRoundState = {
  roundId: string;
  gamePhase: FastAnswerGamePhase;
  phaseRemainingSeconds: number;
  questionId: string;
  question: string;
  categoryId: string;
  /** Server-only during question phase — never leak via player view while open. */
  acceptedAnswers: string[];
  deadlineAtMs: number | null;
  winnerPlayerId: string | null;
  timedOut: boolean;
};

export type FastAnswerMatchState = {
  playerIds: string[];
  playerNames: Record<string, string>;
  currentRound: number;
  totalRounds: number;
  scores: Record<string, number>;
  matchStatus: 'in-progress' | 'completed';
  /** Locked at match start for all 5 rounds. */
  lockedCategoryId: string;
  lockedCategoryLabel: string;
  roundTimeSeconds: number;
  recentQuestionIds: string[];
  round: FastAnswerRoundState;
};

export type FastAnswerLeaderboardEntry = {
  playerId: string;
  name: string;
  score: number;
};

export type FastAnswerRoundResultEntry = {
  playerId: string;
  name: string;
  roundPoints: number;
  totalPoints: number;
  isWinner: boolean;
};

export type FastAnswerPlayerView = {
  gamePhase: FastAnswerGamePhase;
  phaseLabel: string;
  phaseRemainingSeconds: number;
  questionDeadlineAtMs: number | null;
  roundId: string | null;
  question: string | null;
  categoryId: string | null;
  categoryLabel: string | null;
  currentRound: number;
  totalRounds: number;
  matchStatus: 'in-progress' | 'completed';
  canSubmitAnswer: boolean;
  revealedAnswer: string | null;
  winnerPlayerId: string | null;
  winnerName: string | null;
  timedOut: boolean;
  roundResults: FastAnswerRoundResultEntry[];
  leaderboard: FastAnswerLeaderboardEntry[];
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

export const FAST_ANSWER_SYNC_EVENT = pluginActionEvent(FAST_ANSWER_GAME_ID, 'sync');
export const FAST_ANSWER_PHASE_CHANGED_EVENT = pluginActionEvent(
  FAST_ANSWER_GAME_ID,
  'phase-changed',
);
export const FAST_ANSWER_SUBMIT_ANSWER_EVENT = pluginActionEvent(
  FAST_ANSWER_GAME_ID,
  'submit-answer',
);
export const FAST_ANSWER_CONTINUE_ROUND_RESULTS_EVENT = pluginActionEvent(
  FAST_ANSWER_GAME_ID,
  'continue-round-results',
);
export const FAST_ANSWER_STATE_EVENT = pluginStateEvent(FAST_ANSWER_GAME_ID);

export type FastAnswerSubmitAnswerPayload = {
  answer: string;
  roundId: string;
};
