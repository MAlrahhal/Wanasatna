import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const MOST_LIKELY_TO_GAME_ID = 'most-likely-to' as const;
export const MOST_LIKELY_TO_MIN_PLAYERS = 3;
export const MOST_LIKELY_TO_MAX_PLAYERS = 15;
export const MOST_LIKELY_TO_QUESTION_COUNT = 10;
export const MOST_LIKELY_TO_VOTE_SECONDS = 40;

export type MostLikelyToPhase = 'voting' | 'reveal' | 'completed';

export type MostLikelyToNominee = {
  playerId: string;
  name: string;
};

export type MostLikelyToVoteDisclosure = {
  voterPlayerId: string;
  voterName: string;
  nomineePlayerId: string;
  nomineeName: string;
};

export type MostLikelyToNomineeResult = MostLikelyToNominee & {
  voteCount: number;
  voterNames: string[];
};

export type MostLikelyToQuestionResult = {
  questionId: string;
  questionNumber: number;
  question: string;
  nominees: MostLikelyToNomineeResult[];
  votes: MostLikelyToVoteDisclosure[];
  topNomineePlayerIds: string[];
  totalVotes: number;
};

export type MostLikelyToAggregateResult = {
  nominees: MostLikelyToNomineeResult[];
  topNomineePlayerIds: string[];
  totalVotes: number;
};

export type MostLikelyToPlayerView = {
  gameId: typeof MOST_LIKELY_TO_GAME_ID;
  selfPlayerId: string;
  phase: MostLikelyToPhase;
  questionId: string;
  questionNumber: number;
  totalQuestions: number;
  question: string;
  nominees: MostLikelyToNominee[];
  eligibleVoterCount: number;
  submittedVoteCount: number;
  ownVotePlayerId: string | null;
  canVote: boolean;
  isWaitingForNextQuestion: boolean;
  deadlineAtMs: number | null;
  remainingSeconds: number | null;
  result: MostLikelyToQuestionResult | null;
  recap: MostLikelyToQuestionResult[];
  aggregate: MostLikelyToAggregateResult | null;
  canAdvance: boolean;
};

export type MostLikelyToVotePayload = {
  questionId: string;
  nomineePlayerId: string;
  requestId: string;
};

export type MostLikelyToAdvancePayload = {
  questionId: string;
  requestId: string;
};

export const MOST_LIKELY_TO_SYNC_EVENT = pluginActionEvent(MOST_LIKELY_TO_GAME_ID, 'sync');
export const MOST_LIKELY_TO_VOTE_EVENT = pluginActionEvent(MOST_LIKELY_TO_GAME_ID, 'vote');
export const MOST_LIKELY_TO_ADVANCE_EVENT = pluginActionEvent(MOST_LIKELY_TO_GAME_ID, 'advance');
export const MOST_LIKELY_TO_PHASE_CHANGED_EVENT = pluginActionEvent(
  MOST_LIKELY_TO_GAME_ID,
  'phase-changed',
);
export const MOST_LIKELY_TO_STATE_EVENT = pluginStateEvent(MOST_LIKELY_TO_GAME_ID);
