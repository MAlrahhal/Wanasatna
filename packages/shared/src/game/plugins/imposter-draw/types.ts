import type { DrawStroke, DrawStrokePoint, DrawGuessTool } from '../draw-guess/types.js';
import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const IMPOSTER_DRAW_GAME_ID = 'imposter-draw' as const;

export const IMPOSTER_DRAW_DEFAULT_ROUNDS = 3;
export const IMPOSTER_DRAW_TURN_SECONDS = 10;
export const IMPOSTER_DRAW_GUESS_SECONDS = 20;
export const IMPOSTER_DRAW_REVEAL_SECONDS = 10;

export type ImposterDrawGamePhase =
  | 'drawing-turns'
  | 'voting'
  | 'reveal'
  | 'impostor-guess'
  | 'round-results'
  | 'match-completed';

export type ImposterDrawRole = 'crew' | 'impostor';

export type ImposterDrawReferenceImage = {
  id: string;
  label: string;
  imageUrl: string;
  categoryId: string;
};

export type ImposterDrawVoteTallyEntry = {
  playerId: string;
  name: string;
  voteCount: number;
};

export type ImposterDrawRoundState = {
  imageId: string;
  imageLabel: string;
  imageUrl: string;
  imageCategoryId: string;
  impostorPlayerId: string;
  drawingOrder: string[];
  currentDrawerIndex: number;
  turnDurationSeconds: number;
  gamePhase: ImposterDrawGamePhase;
  phaseRemainingSeconds: number;
  strokes: DrawStroke[];
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
  referenceImage: ImposterDrawReferenceImage | null;
  currentDrawerPlayerId: string | null;
  currentDrawerName: string | null;
  canDraw: boolean;
  strokes: DrawStroke[];
  drawingOrder: string[];
  currentRound: number;
  totalRounds: number;
  matchStatus: 'in-progress' | 'completed';
  hasVoted: boolean;
  votablePlayers: Array<{ playerId: string; name: string }>;
  submittedVotesCount: number;
  eligibleVotersCount: number;
  confirmedVoteTargetPlayerId: string | null;
  revealedImage: ImposterDrawReferenceImage | null;
  revealedImpostorPlayerId: string | null;
  revealedImpostorName: string | null;
  impostorVotedOut: boolean | null;
  voteTally: ImposterDrawVoteTallyEntry[];
  impostorGuessOptions: string[];
  canGuessImage: boolean;
  hasSubmittedImageGuess: boolean;
  selectedImageGuess: string | null;
  impostorGuessedCorrectly: boolean | null;
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
export const IMPOSTER_DRAW_CLEAR_CANVAS_EVENT = pluginActionEvent(
  IMPOSTER_DRAW_GAME_ID,
  'clear-canvas',
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
  strokeId: string;
  tool: DrawGuessTool;
  color: string;
  size: number;
  points: DrawStrokePoint[];
};

export type ImposterDrawStrokePointsPayload = {
  strokeId: string;
  points: DrawStrokePoint[];
};

export type ImposterDrawSubmitVotePayload = {
  targetPlayerId: string;
};

export type ImposterDrawSubmitImageGuessPayload = {
  selectedWord: string;
};

export type ImposterDrawCanvasUpdatedPayload = {
  strokes: DrawStroke[];
};
