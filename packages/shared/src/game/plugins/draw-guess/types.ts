import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const DRAW_GUESS_GAME_ID = 'draw-guess' as const;

export const DRAW_GUESS_DEFAULT_ROUNDS = 3;
export const DRAW_GUESS_DEFAULT_DRAW_SECONDS = 60;

export type DrawGuessGamePhase = 'drawing' | 'round-results' | 'match-completed';

export type DrawGuessTool = 'draw' | 'erase';

export type DrawStrokePoint = {
  x: number;
  y: number;
};

export type DrawStroke = {
  id: string;
  tool: DrawGuessTool;
  color: string;
  size: number;
  points: DrawStrokePoint[];
};

export type DrawGuessRoundState = {
  word: string;
  wordCategoryId: string;
  drawerPlayerId: string;
  gamePhase: DrawGuessGamePhase;
  phaseRemainingSeconds: number;
  drawingDurationSeconds: number;
  strokes: DrawStroke[];
  correctGuesserPlayerId: string | null;
  guessedCorrectly: boolean;
};

export type DrawGuessMatchState = {
  playerIds: string[];
  playerNames: Record<string, string>;
  currentRound: number;
  totalRounds: number;
  scores: Record<string, number>;
  matchStatus: 'in-progress' | 'completed';
  round: DrawGuessRoundState;
};

export type DrawGuessLeaderboardEntry = {
  playerId: string;
  name: string;
  score: number;
};

export type DrawGuessRoundResultEntry = {
  playerId: string;
  name: string;
  roundPoints: number;
  totalPoints: number;
  isDrawer: boolean;
  isCorrectGuesser: boolean;
};

export type DrawGuessPlayerView = {
  gamePhase: DrawGuessGamePhase;
  phaseLabel: string;
  phaseRemainingSeconds: number;
  role: 'drawer' | 'guesser';
  secretWord: string | null;
  drawerPlayerId: string;
  drawerName: string;
  strokes: DrawStroke[];
  currentRound: number;
  totalRounds: number;
  matchStatus: 'in-progress' | 'completed';
  revealedWord: string | null;
  correctGuesserPlayerId: string | null;
  correctGuesserName: string | null;
  guessedCorrectly: boolean;
  roundResults: DrawGuessRoundResultEntry[];
  leaderboard: DrawGuessLeaderboardEntry[];
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
  canGuess: boolean;
};

export const DRAW_GUESS_SYNC_EVENT = pluginActionEvent(DRAW_GUESS_GAME_ID, 'sync');
export const DRAW_GUESS_PHASE_CHANGED_EVENT = pluginActionEvent(
  DRAW_GUESS_GAME_ID,
  'phase-changed',
);
export const DRAW_GUESS_STROKE_EVENT = pluginActionEvent(DRAW_GUESS_GAME_ID, 'stroke');
export const DRAW_GUESS_STROKE_POINTS_EVENT = pluginActionEvent(
  DRAW_GUESS_GAME_ID,
  'stroke-points',
);
export const DRAW_GUESS_CLEAR_CANVAS_EVENT = pluginActionEvent(
  DRAW_GUESS_GAME_ID,
  'clear-canvas',
);
export const DRAW_GUESS_SUBMIT_GUESS_EVENT = pluginActionEvent(
  DRAW_GUESS_GAME_ID,
  'submit-guess',
);
export const DRAW_GUESS_CONTINUE_ROUND_RESULTS_EVENT = pluginActionEvent(
  DRAW_GUESS_GAME_ID,
  'continue-round-results',
);
export const DRAW_GUESS_CANVAS_UPDATED_EVENT = pluginActionEvent(
  DRAW_GUESS_GAME_ID,
  'canvas-updated',
);
export const DRAW_GUESS_STATE_EVENT = pluginStateEvent(DRAW_GUESS_GAME_ID);

export type DrawGuessStrokePayload = {
  strokeId: string;
  tool: DrawGuessTool;
  color: string;
  size: number;
  points: DrawStrokePoint[];
};

export type DrawGuessStrokePointsPayload = {
  strokeId: string;
  points: DrawStrokePoint[];
};

export type DrawGuessSubmitGuessPayload = {
  guess: string;
};

export type DrawGuessCanvasUpdatedPayload = {
  strokes: DrawStroke[];
};
