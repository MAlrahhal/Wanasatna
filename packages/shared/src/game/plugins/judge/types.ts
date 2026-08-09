import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const JUDGE_GAME_ID = 'judge' as const;

export const JUDGE_DEFAULT_ROUNDS = 4;
export const JUDGE_MAX_ANSWER_LENGTH = 150;
export const JUDGE_WINNER_POINTS = 100;

export type JudgeGamePhase = 'answering' | 'judging' | 'round-results' | 'match-completed';

export type JudgeAnswerRecord = {
  answerId: string;
  ownerPlayerId: string;
  text: string;
};

export type JudgeRoundState = {
  gamePhase: JudgeGamePhase;
  phaseRemainingSeconds: number;
  judgePlayerId: string;
  promptId: string;
  prompt: string;
  categoryId: string;
  answers: JudgeAnswerRecord[];
  /** Authoritative card order — empty until judging. */
  shuffledAnswerIds: string[];
  winningAnswerId: string | null;
};

export type JudgeMatchState = {
  playerIds: string[];
  playerNames: Record<string, string>;
  /** Fair rotation queue; recycled when exhausted. */
  judgeOrder: string[];
  judgeOrderIndex: number;
  currentRound: number;
  totalRounds: number;
  scores: Record<string, number>;
  matchStatus: 'in-progress' | 'completed';
  recentPromptIds: string[];
  round: JudgeRoundState;
};

export type JudgeAnonymousAnswer = {
  answerId: string;
  text: string;
};

export type JudgeRevealEntry = {
  answerId: string;
  text: string;
  ownerPlayerId: string;
  ownerName: string;
  isWinner: boolean;
};

export type JudgeRoundResultEntry = {
  playerId: string;
  name: string;
  roundPoints: number;
  totalPoints: number;
  isWinner: boolean;
  isJudge: boolean;
};

export type JudgeLeaderboardEntry = {
  playerId: string;
  name: string;
  score: number;
};

export type JudgePlayerView = {
  gamePhase: JudgeGamePhase;
  phaseLabel: string;
  phaseRemainingSeconds: number;
  prompt: string | null;
  categoryId: string | null;
  nextCategoryId: string | null;
  currentRound: number;
  totalRounds: number;
  matchStatus: 'in-progress' | 'completed';
  judgePlayerId: string | null;
  judgeName: string | null;
  isJudge: boolean;
  canSubmitAnswer: boolean;
  hasSubmittedAnswer: boolean;
  submittedAnswerCount: number;
  totalAnswerSlots: number;
  anonymousAnswers: JudgeAnonymousAnswer[];
  canSelectWinner: boolean;
  selectedWinningAnswerId: string | null;
  revealEntries: JudgeRevealEntry[];
  winningAnswerText: string | null;
  winnerName: string | null;
  roundResults: JudgeRoundResultEntry[];
  leaderboard: JudgeLeaderboardEntry[];
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

export const JUDGE_SYNC_EVENT = pluginActionEvent(JUDGE_GAME_ID, 'sync');
export const JUDGE_PHASE_CHANGED_EVENT = pluginActionEvent(JUDGE_GAME_ID, 'phase-changed');
export const JUDGE_SUBMIT_ANSWER_EVENT = pluginActionEvent(JUDGE_GAME_ID, 'submit-answer');
export const JUDGE_SELECT_WINNER_EVENT = pluginActionEvent(JUDGE_GAME_ID, 'select-winner');
export const JUDGE_CONTINUE_ROUND_RESULTS_EVENT = pluginActionEvent(
  JUDGE_GAME_ID,
  'continue-round-results',
);
export const JUDGE_SET_CATEGORY_EVENT = pluginActionEvent(JUDGE_GAME_ID, 'set-category');
export const JUDGE_STATE_EVENT = pluginStateEvent(JUDGE_GAME_ID);

export type JudgeSubmitAnswerPayload = {
  answer: string;
};

export type JudgeSelectWinnerPayload = {
  answerId: string;
};

export type JudgeSetCategoryPayload = {
  categoryId: string | null;
};
