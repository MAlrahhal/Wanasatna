import { pluginActionEvent } from '../../plugin/events.js';

export const BARA_AL_SALAFA_GAME_ID = 'bara-al-salafa' as const;

/** Role / secret reveal maximum duration (seconds). */
export const BARA_AL_SALAFA_ROLE_REVEAL_DURATION_SECONDS = 20;

/** Directed / free question turn maximum duration (seconds). */
export const BARA_AL_SALAFA_QUESTION_TURN_DURATION_SECONDS = 60;

export const BARA_AL_SALAFA_VOTING_DURATION_SECONDS = 60;

export const BARA_AL_SALAFA_REVEAL_DURATION_SECONDS = 5;

export const BARA_AL_SALAFA_IMPOSTOR_GUESS_DURATION_SECONDS = 60;

/** Short shared feedback after impostor submits (or times out). */
export const BARA_AL_SALAFA_GUESS_RESULT_DURATION_SECONDS = 3;

export const BARA_AL_SALAFA_IMPOSTOR_GUESS_OPTION_COUNT = 8;

export const BARA_AL_SALAFA_ROUND_RESULTS_DURATION_SECONDS = 10;

export const BARA_AL_SALAFA_MATCH_RESULTS_DURATION_SECONDS = 30;

export const BARA_AL_SALAFA_ROUND_SCORE_POINTS = 100;

/** Free product: fixed match length. */
export const BARA_AL_SALAFA_DEFAULT_ROUNDS = 3;

export const BARA_AL_SALAFA_MAX_PLAYERS = 8;

export type BaraAlSalafaRole = 'impostor' | 'player';

export type BaraAlSalafaMatchStatus = 'in-progress' | 'completed';

export type BaraAlSalafaGamePhase =
  | 'description'
  | 'directed-questions'
  | 'free-questions'
  | 'voting'
  | 'reveal-impostor'
  | 'impostor-guess'
  | 'impostor-guess-result'
  | 'round-results'
  | 'match-completed';

export type BaraAlSalafaSelectablePlayer = {
  id: string;
  name: string;
};

export type BaraAlSalafaLeaderboardEntry = {
  playerId: string;
  name: string;
  score: number;
  isFirstPlace: boolean;
};

export type BaraAlSalafaRoundResultEntry = {
  playerId: string;
  name: string;
  roundPoints: number;
  totalPoints: number;
  isImpostor: boolean;
  earnedPoints: boolean;
};

export type BaraAlSalafaResultsLeaderboardEntry = {
  playerId: string;
  name: string;
  totalPoints: number;
  rank: number;
  isFirstPlace: boolean;
};

export type BaraAlSalafaDirectedQuestionPair = {
  askerPlayerId: string;
  targetPlayerId: string;
};

/** Per-round state — recreated at the start of each round. */
export type BaraAlSalafaRoundState = {
  word: string;
  wordCategoryId: string;
  /** Public Arabic category name (safe for all players). */
  categoryName: string;
  impostorPlayerId: string;
  gamePhase: BaraAlSalafaGamePhase;
  phaseRemainingSeconds: number;
  descriptionDurationSeconds: number;
  questionTurnDurationSeconds: number;
  speakingOrder: string[];
  directedQuestionPairs: BaraAlSalafaDirectedQuestionPair[];
  currentSpeakerIndex: number;
  activeFreeQuestionPlayerId: string | null;
  pendingFreeQuestionTargetPlayerId: string | null;
  completedFreeQuestionTurns: string[];
  roleUnderstoodPlayerIds: string[];
  votes: Record<string, string>;
  submittedVoterIds: string[];
  votingDurationSeconds: number;
  revealDurationSeconds: number;
  impostorGuessOptions: string[];
  impostorGuessDurationSeconds: number;
  selectedWord: string | null;
  guessedCorrectly: boolean | null;
  roundResultsDurationSeconds: number;
  guessResultDurationSeconds: number;
};

/** Match-level state — persists across rounds until the match ends. */
export type BaraAlSalafaMatchState = {
  playerIds: string[];
  playerNames: Record<string, string>;
  currentRound: number;
  totalRounds: number;
  scores: Record<string, number>;
  matchStatus: BaraAlSalafaMatchStatus;
  /** Secret words already used this match (avoid repeats when alternatives exist). */
  usedWordTexts: string[];
  round: BaraAlSalafaRoundState;
};

/** @deprecated Alias for match state stored per room. */
export type BaraAlSalafaState = BaraAlSalafaMatchState;

/** Player-specific view — safe to send to one client. */
export type BaraAlSalafaPlayerView = {
  role: BaraAlSalafaRole;
  displayText: string;
  gamePhase: BaraAlSalafaGamePhase;
  phaseLabel: string;
  phaseRemainingSeconds: number;
  /** Public category label, e.g. "أكلات". Never the secret word. */
  categoryName: string | null;
  instruction: string | null;
  currentSpeakerName: string | null;
  directedQuestionAskerPlayerId: string | null;
  directedQuestionAskerName: string | null;
  directedQuestionTargetPlayerId: string | null;
  directedQuestionTargetName: string | null;
  directedQuestionCurrentTurn: number;
  directedQuestionTotalTurns: number;
  isDirectedQuestionActiveAsker: boolean;
  hasAcknowledgedRole: boolean;
  roleAcknowledgementCount: number;
  eligibleRoleAcknowledgementCount: number;
  isFreeQuestionActivePlayer: boolean;
  selectablePlayers: BaraAlSalafaSelectablePlayer[];
  activeFreeQuestionPlayerId: string | null;
  activeFreeQuestionPlayerName: string | null;
  activeFreeQuestionTargetPlayerId: string | null;
  activeFreeQuestionTargetPlayerName: string | null;
  completedFreeQuestionPlayerIds: string[];
  hasVoted: boolean;
  votablePlayers: BaraAlSalafaSelectablePlayer[];
  submittedVotesCount: number;
  eligibleVotersCount: number;
  confirmedVoteTargetPlayerId: string | null;
  currentRound: number;
  totalRounds: number;
  matchStatus: BaraAlSalafaMatchStatus;
  revealedImpostorPlayerId: string | null;
  revealedImpostorName: string | null;
  isImpostorGuessActivePlayer: boolean;
  impostorGuessOptions: string[];
  hasSubmittedImpostorGuess: boolean;
  revealedWord: string | null;
  /** Shared guess outcome copy for impostor-guess-result phase. */
  guessResultMessage: string | null;
  leaderboard: BaraAlSalafaLeaderboardEntry[];
  roundResults: BaraAlSalafaRoundResultEntry[];
  resultsLeaderboard: BaraAlSalafaResultsLeaderboardEntry[];
  impostorGuessedCorrectly: boolean | null;
  matchPlayerCount: number;
  isFinalResults: boolean;
  isHost: boolean;
  canContinueFromRoundResults: boolean;
  roundResultsContinueLabel: string | null;
  roundResultsWaitingMessage: string | null;
  /** Mid-match joiner: no secrets, no actions. */
  isMatchSpectator: boolean;
};

export const BARA_AL_SALAFA_SYNC_EVENT = pluginActionEvent(BARA_AL_SALAFA_GAME_ID, 'sync');

export const BARA_AL_SALAFA_PHASE_CHANGED_EVENT = pluginActionEvent(
  BARA_AL_SALAFA_GAME_ID,
  'phase-changed',
);

export const BARA_AL_SALAFA_CHOOSE_FREE_QUESTION_PLAYER_EVENT = pluginActionEvent(
  BARA_AL_SALAFA_GAME_ID,
  'choose-free-question-player',
);

export const BARA_AL_SALAFA_SKIP_FREE_QUESTION_TURN_EVENT = pluginActionEvent(
  BARA_AL_SALAFA_GAME_ID,
  'skip-free-question-turn',
);

export const BARA_AL_SALAFA_ADVANCE_FREE_QUESTION_EVENT = pluginActionEvent(
  BARA_AL_SALAFA_GAME_ID,
  'advance-free-question',
);

export const BARA_AL_SALAFA_SUBMIT_VOTE_EVENT = pluginActionEvent(
  BARA_AL_SALAFA_GAME_ID,
  'submit-vote',
);

export const BARA_AL_SALAFA_SUBMIT_IMPOSTOR_GUESS_EVENT = pluginActionEvent(
  BARA_AL_SALAFA_GAME_ID,
  'submit-impostor-guess',
);

export const BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT = pluginActionEvent(
  BARA_AL_SALAFA_GAME_ID,
  'submit-role-understood',
);

export const BARA_AL_SALAFA_ADVANCE_DIRECTED_QUESTION_EVENT = pluginActionEvent(
  BARA_AL_SALAFA_GAME_ID,
  'advance-directed-question',
);

export const BARA_AL_SALAFA_CONTINUE_ROUND_RESULTS_EVENT = pluginActionEvent(
  BARA_AL_SALAFA_GAME_ID,
  'continue-round-results',
);

export type BaraAlSalafaChooseFreeQuestionPlayerPayload = {
  targetPlayerId: string;
};

export type BaraAlSalafaSubmitVotePayload = {
  targetPlayerId: string;
};

export type BaraAlSalafaSubmitImpostorGuessPayload = {
  selectedWord: string;
};

export type BaraAlSalafaSyncResponse =
  | { success: true; data: { view: BaraAlSalafaPlayerView } }
  | { success: false; error: { code: string; message: string } };

export type BaraAlSalafaFreeQuestionActionResponse =
  | { success: true; data: { view: BaraAlSalafaPlayerView } }
  | { success: false; error: { code: string; message: string } };

export type BaraAlSalafaSubmitVoteResponse =
  | { success: true; data: { view: BaraAlSalafaPlayerView } }
  | { success: false; error: { code: string; message: string } };

export type BaraAlSalafaSubmitImpostorGuessResponse =
  | { success: true; data: { view: BaraAlSalafaPlayerView } }
  | { success: false; error: { code: string; message: string } };
