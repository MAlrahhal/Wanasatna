import type { DrawStroke, DrawStrokePoint, DrawGuessTool } from '../draw-guess/types.js';
import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const IMPOSTER_DRAW_GAME_ID = 'imposter-draw' as const;

export const IMPOSTER_DRAW_DEFAULT_ROUNDS = 3;
export const IMPOSTER_DRAW_BRIEFING_SECONDS = 20;
export const IMPOSTER_DRAW_TURN_SECONDS = 15;
export const IMPOSTER_DRAW_VOTING_SECONDS = 60;
export const IMPOSTER_DRAW_GUESS_SECONDS = 30;
export const IMPOSTER_DRAW_REVEAL_SECONDS = 10;
export const IMPOSTER_DRAW_ROUND_RESULTS_SECONDS = 10;
/** @deprecated Prefer IMPOSTER_DRAW_TURN_SECONDS */
export const IMPOSTER_DRAW_DEFAULT_TURN_SECONDS = IMPOSTER_DRAW_TURN_SECONDS;

export type ImposterDrawGamePhase =
  | 'briefing'
  | 'drawing-turns'
  | 'voting'
  | 'reveal'
  | 'impostor-guess'
  | 'guess-result'
  | 'round-results'
  | 'match-completed';

export type ImposterDrawRole = 'crew' | 'impostor';

export type ImposterDrawReferenceImage = {
  id: string;
  label: string;
  imageUrl: string;
  categoryId: string;
};

export type ImposterDrawRoundState = {
  turnId: string;
  imageId: string;
  imageLabel: string;
  imageUrl: string;
  imageCategoryId: string;
  impostorPlayerId: string;
  drawingOrder: string[];
  currentDrawerIndex: number;
  /** Stroke ids created by the current drawer during the active turnId. */
  currentTurnStrokeIds: string[];
  turnDurationSeconds: number;
  gamePhase: ImposterDrawGamePhase;
  phaseRemainingSeconds: number;
  strokes: DrawStroke[];
  roleUnderstoodPlayerIds: string[];
  votes: Record<string, string>;
  submittedVoterIds: string[];
  impostorVotedOut: boolean | null;
  impostorGuessOptions: string[];
  selectedImageGuess: string | null;
  impostorGuessedCorrectly: boolean | null;
  revealDurationSeconds: number;
  guessDurationSeconds: number;
};

export type ImposterDrawMatchState = {
  playerIds: string[];
  playerNames: Record<string, string>;
  currentRound: number;
  totalRounds: number;
  scores: Record<string, number>;
  matchStatus: 'in-progress' | 'completed';
  usedImageTexts: string[];
  previousImpostorPlayerId: string | null;
  round: ImposterDrawRoundState;
};

export type ImposterDrawLeaderboardEntry = {
  playerId: string;
  name: string;
  score: number;
};

export type ImposterDrawRoundResultEntry = {
  playerId: string;
  name: string;
  roundPoints: number;
  totalPoints: number;
  isImpostor: boolean;
  votedCorrectly: boolean;
};

export type ImposterDrawPlayerView = {
  gamePhase: ImposterDrawGamePhase;
  phaseLabel: string;
  phaseRemainingSeconds: number;
  role: ImposterDrawRole;
  /** Only present during briefing for crew (or reconnect during briefing). Never after. */
  referenceImage: ImposterDrawReferenceImage | null;
  turnId: string;
  currentDrawerPlayerId: string | null;
  currentDrawerName: string | null;
  canDraw: boolean;
  strokes: DrawStroke[];
  drawingOrder: string[];
  currentRound: number;
  totalRounds: number;
  matchStatus: 'in-progress' | 'completed';
  hasAcknowledgedBriefing: boolean;
  briefingAckCount: number;
  eligibleBriefingAckCount: number;
  hasVoted: boolean;
  votablePlayers: Array<{ playerId: string; name: string }>;
  submittedVotesCount: number;
  eligibleVotersCount: number;
  confirmedVoteTargetPlayerId: string | null;
  revealedImpostorPlayerId: string | null;
  revealedImpostorName: string | null;
  impostorVotedOut: boolean | null;
  impostorGuessOptions: string[];
  canGuessImage: boolean;
  hasSubmittedImageGuess: boolean;
  selectedImageGuess: string | null;
  impostorGuessedCorrectly: boolean | null;
  guessResultMessage: string | null;
  playersWon: boolean | null;
  roundResults: ImposterDrawRoundResultEntry[];
  leaderboard: ImposterDrawLeaderboardEntry[];
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
  /** Revealed answer label only after guess resolves (results phases). Never an image. */
  revealedAnswerLabel: string | null;
};

export const IMPOSTER_DRAW_SYNC_EVENT = pluginActionEvent(IMPOSTER_DRAW_GAME_ID, 'sync');
export const IMPOSTER_DRAW_PHASE_CHANGED_EVENT = pluginActionEvent(
  IMPOSTER_DRAW_GAME_ID,
  'phase-changed',
);
export const IMPOSTER_DRAW_STROKE_EVENT = pluginActionEvent(IMPOSTER_DRAW_GAME_ID, 'stroke');
export const IMPOSTER_DRAW_STROKE_POINTS_EVENT = pluginActionEvent(
  IMPOSTER_DRAW_GAME_ID,
  'stroke-points',
);
export const IMPOSTER_DRAW_UNDO_EVENT = pluginActionEvent(IMPOSTER_DRAW_GAME_ID, 'undo');
export const IMPOSTER_DRAW_SUBMIT_ROLE_UNDERSTOOD_EVENT = pluginActionEvent(
  IMPOSTER_DRAW_GAME_ID,
  'submit-role-understood',
);
export const IMPOSTER_DRAW_SUBMIT_VOTE_EVENT = pluginActionEvent(
  IMPOSTER_DRAW_GAME_ID,
  'submit-vote',
);
export const IMPOSTER_DRAW_SUBMIT_IMAGE_GUESS_EVENT = pluginActionEvent(
  IMPOSTER_DRAW_GAME_ID,
  'submit-image-guess',
);
export const IMPOSTER_DRAW_CONTINUE_ROUND_RESULTS_EVENT = pluginActionEvent(
  IMPOSTER_DRAW_GAME_ID,
  'continue-round-results',
);
export const IMPOSTER_DRAW_CANVAS_UPDATED_EVENT = pluginActionEvent(
  IMPOSTER_DRAW_GAME_ID,
  'canvas-updated',
);
export const IMPOSTER_DRAW_STATE_EVENT = pluginStateEvent(IMPOSTER_DRAW_GAME_ID);

export type ImposterDrawStrokePayload = {
  turnId: string;
  strokeId: string;
  tool: DrawGuessTool;
  color: string;
  size: number;
  points: DrawStrokePoint[];
};

export type ImposterDrawStrokePointsPayload = {
  turnId: string;
  strokeId: string;
  points: DrawStrokePoint[];
};

export type ImposterDrawTurnScopedPayload = {
  turnId: string;
};

export type ImposterDrawSubmitVotePayload = {
  targetPlayerId: string;
};

export type ImposterDrawSubmitImageGuessPayload = {
  selectedWord: string;
};

export type ImposterDrawCanvasUpdatedPayload = {
  turnId: string;
  strokes: DrawStroke[];
};
