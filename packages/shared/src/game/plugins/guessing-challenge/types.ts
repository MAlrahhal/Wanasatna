import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const GUESSING_CHALLENGE_GAME_ID = 'guessing-challenge' as const;

export const GUESSING_CHALLENGE_DEFAULT_ROUNDS = 4;
export const GUESSING_CHALLENGE_MAX_GUESS_LENGTH = 80;
export const GUESSING_CHALLENGE_WINNER_POINTS = 100;
export const GUESSING_CHALLENGE_YELLOW_QUESTIONS = 3;
export const GUESSING_CHALLENGE_LOOK_THROTTLE_MS = 100;

export type GuessingChallengeMode = '1v1' | '2v2';
export type GuessingChallengeTeamId = 'blue' | 'red';
export type GuessingChallengeSeat = 0 | 1;
export type GuessingChallengeSpecialCard = 'yellow' | 'red';

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

/** Match-scoped team cards (one yellow + one red per team per match). */
export type GuessingChallengeTeamCards = {
  yellowUsed: boolean;
  redUsed: boolean;
};

export type GuessingChallengeCardConfirm = {
  card: GuessingChallengeSpecialCard;
  teamId: GuessingChallengeTeamId;
  confirmedPlayerIds: string[];
};

export type GuessingChallengeLookDirection = {
  yaw: number;
  pitch: number;
};

export type GuessingChallengeRoundState = {
  gamePhase: GuessingChallengeGamePhase;
  phaseRemainingSeconds: number;
  resolvedCategoryId: string;
  /** Server-only map of teamId → secret identity (one shared identity per team). */
  identitiesByTeamId: Record<GuessingChallengeTeamId, GuessingChallengeIdentitySecret>;
  usedIdentityIds: string[];
  currentTurnTeamId: GuessingChallengeTeamId;
  startingTeamId: GuessingChallengeTeamId;
  /** Remaining questions in active yellow sequence; null when inactive. */
  yellowQuestionsRemaining: number | null;
  winningTeamId: GuessingChallengeTeamId | null;
  /** Player who submitted the winning guess (audit); winner is the team. */
  winningPlayerId: string | null;
  winningGuess: string | null;
  identityChangedNoticeTeamId: GuessingChallengeTeamId | null;
  cardConfirm: GuessingChallengeCardConfirm | null;
};

export type GuessingChallengeMatchState = {
  mode: GuessingChallengeMode;
  playerIds: string[];
  playerNames: Record<string, string>;
  teamByPlayerId: Record<string, GuessingChallengeTeamId>;
  seatByPlayerId: Record<string, GuessingChallengeSeat>;
  /** Match-scoped; do not reset between rounds. */
  teamCards: Record<GuessingChallengeTeamId, GuessingChallengeTeamCards>;
  teamScores: Record<GuessingChallengeTeamId, number>;
  /** Display scores mirrored from teamScores (no double-awarding). */
  scores: Record<string, number>;
  lookByPlayerId: Record<string, GuessingChallengeLookDirection>;
  currentRound: number;
  totalRounds: number;
  matchStatus: 'in-progress' | 'completed';
  nextStartingTeamId: GuessingChallengeTeamId;
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

export type GuessingChallengeOpponentView = {
  playerId: string;
  name: string;
  seat: GuessingChallengeSeat;
  lookYaw: number;
  lookPitch: number;
  /** Opposing team's shared identity (same for all opponents). */
  visibleIdentity: GuessingChallengeVisibleIdentity | null;
};

export type GuessingChallengeTeammateView = {
  playerId: string;
  name: string;
  seat: GuessingChallengeSeat;
  lookYaw: number;
  lookPitch: number;
};

export type GuessingChallengeCardConfirmStatus = {
  card: GuessingChallengeSpecialCard;
  confirmedCount: number;
  requiredCount: number;
  selfConfirmed: boolean;
  message: string;
  /** First teammate who opened the confirmation request. */
  requestingPlayerId: string;
  requestingPlayerName: string;
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
  mode: GuessingChallengeMode;
  selfTeam: GuessingChallengeTeamId | null;
  selfSeat: GuessingChallengeSeat | null;
  /** Representative player on the current turn team (seat 0) — 1v1-compatible. */
  currentTurnPlayerId: string | null;
  currentTurnTeamId: GuessingChallengeTeamId | null;
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
  teammate: GuessingChallengeTeammateView | null;
  /** Primary opponent (seat 0) — kept for 1v1 client compatibility. */
  opponent: {
    playerId: string;
    name: string;
    visibleIdentity: GuessingChallengeVisibleIdentity | null;
  };
  opponents: GuessingChallengeOpponentView[];
  yellowQuestionsRemaining: number | null;
  canEndQuestion: boolean;
  canGuess: boolean;
  canUseYellow: boolean;
  canUseRed: boolean;
  cardConfirmStatus: GuessingChallengeCardConfirmStatus | null;
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
/** Confirm yellow-card use (1v1 activates alone; 2v2 needs all connected teammates). */
export const GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT = pluginActionEvent(
  GUESSING_CHALLENGE_GAME_ID,
  'use-yellow-card',
);
/** Confirm red-card use (1v1 activates alone; 2v2 needs all connected teammates). */
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
/** Client → server look direction (throttled server-side). */
export const GUESSING_CHALLENGE_LOOK_EVENT = pluginActionEvent(
  GUESSING_CHALLENGE_GAME_ID,
  'look',
);
/** Server → clients lightweight look broadcast (not a full sync). */
export const GUESSING_CHALLENGE_LOOK_UPDATE_EVENT = pluginActionEvent(
  GUESSING_CHALLENGE_GAME_ID,
  'look-update',
);
export const GUESSING_CHALLENGE_STATE_EVENT = pluginStateEvent(GUESSING_CHALLENGE_GAME_ID);

export type GuessingChallengeSubmitFinalGuessPayload = {
  guess: string;
};

export type GuessingChallengeSetCategoryPayload = {
  categoryId: string | null;
};

export type GuessingChallengeLookPayload = {
  yaw: number;
  pitch: number;
};

export type GuessingChallengeLookUpdatePayload = {
  playerId: string;
  yaw: number;
  pitch: number;
};
