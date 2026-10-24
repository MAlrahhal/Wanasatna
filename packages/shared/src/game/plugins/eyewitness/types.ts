import type { DrawStroke } from '../draw-guess/types.js';
import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const EYEWITNESS_GAME_ID = 'eyewitness' as const;
export const EYEWITNESS_MIN_PLAYERS = 3;
export const EYEWITNESS_MAX_PLAYERS = 15;

/** Provisional closed-playtest values pending owner approval. */
export const EYEWITNESS_ROUND_OPTIONS = [3, 5, 7, 10, 15] as const;
export const EYEWITNESS_DESCRIPTION_SECONDS_OPTIONS = [60, 90, 120] as const;
export const EYEWITNESS_DRAWING_SECONDS_OPTIONS = [45, 60, 90] as const;
export const EYEWITNESS_VOTING_SECONDS_OPTIONS = [30, 60, 90] as const;

export type EyewitnessSettings = {
  roundCount: (typeof EYEWITNESS_ROUND_OPTIONS)[number];
  descriptionSeconds: (typeof EYEWITNESS_DESCRIPTION_SECONDS_OPTIONS)[number];
  drawingSeconds: (typeof EYEWITNESS_DRAWING_SECONDS_OPTIONS)[number];
  votingSeconds: (typeof EYEWITNESS_VOTING_SECONDS_OPTIONS)[number];
};

export const EYEWITNESS_DEFAULT_SETTINGS: EyewitnessSettings = {
  roundCount: 5,
  descriptionSeconds: 90,
  drawingSeconds: 60,
  votingSeconds: 60,
};

export type EyewitnessPhase = 'witness' | 'drawing' | 'voting' | 'round-results' | 'completed';

export type EyewitnessLobbyView = {
  gameId: typeof EYEWITNESS_GAME_ID;
  settings: EyewitnessSettings;
  canEditSettings: boolean;
  participantCount: number;
  minPlayers: number;
};

export type EyewitnessAnonymousArtwork = {
  artworkId: string;
  strokes: DrawStroke[];
};

export type EyewitnessResultArtwork = EyewitnessAnonymousArtwork & {
  artistPlayerId: string;
  artistName: string;
  voteCount: number;
  isRoundWinner: boolean;
};

export type EyewitnessLeaderboardEntry = {
  playerId: string;
  playerName: string;
  wins: number;
  isMatchWinner: boolean;
};

export type EyewitnessPlayerView = {
  gameId: typeof EYEWITNESS_GAME_ID;
  selfPlayerId: string;
  settings: EyewitnessSettings;
  phase: EyewitnessPhase;
  currentRound: number;
  totalRounds: number;
  roundId: string;
  witnessPlayerId: string;
  witnessName: string;
  isWitness: boolean;
  isArtist: boolean;
  isSpectator: boolean;
  isHost: boolean;
  canEditDescription: boolean;
  canSubmitDescription: boolean;
  canDraw: boolean;
  canSubmitArtwork: boolean;
  canVote: boolean;
  canAdvance: boolean;
  privateReferenceImageDataUrl: string | null;
  revealedReferenceImageDataUrl: string | null;
  ownDescriptionDraft: string | null;
  lockedDescription: string | null;
  ownArtworkId: string | null;
  ownStrokes: DrawStroke[];
  ownArtworkSubmitted: boolean;
  submittedArtworkCount: number;
  eligibleArtistCount: number;
  anonymousArtworks: EyewitnessAnonymousArtwork[];
  confirmedArtworkId: string | null;
  resultArtworks: EyewitnessResultArtwork[];
  leaderboard: EyewitnessLeaderboardEntry[];
  roundWinnerArtworkIds: string[];
  resultReason: 'voting-complete' | 'witness-left' | 'insufficient-players' | null;
  deadlineAtMs: number | null;
  remainingSeconds: number | null;
  waitingForWitness: boolean;
};

export const EYEWITNESS_LOBBY_SYNC_EVENT = pluginActionEvent(EYEWITNESS_GAME_ID, 'lobby-sync');
export const EYEWITNESS_UPDATE_SETTINGS_EVENT = pluginActionEvent(
  EYEWITNESS_GAME_ID,
  'update-settings',
);
export const EYEWITNESS_SYNC_EVENT = pluginActionEvent(EYEWITNESS_GAME_ID, 'sync');
export const EYEWITNESS_UPDATE_DESCRIPTION_EVENT = pluginActionEvent(
  EYEWITNESS_GAME_ID,
  'update-description',
);
export const EYEWITNESS_SUBMIT_DESCRIPTION_EVENT = pluginActionEvent(
  EYEWITNESS_GAME_ID,
  'submit-description',
);
export const EYEWITNESS_STROKE_EVENT = pluginActionEvent(EYEWITNESS_GAME_ID, 'stroke');
export const EYEWITNESS_STROKE_POINTS_EVENT = pluginActionEvent(
  EYEWITNESS_GAME_ID,
  'stroke-points',
);
export const EYEWITNESS_CLEAR_CANVAS_EVENT = pluginActionEvent(EYEWITNESS_GAME_ID, 'clear-canvas');
export const EYEWITNESS_UNDO_EVENT = pluginActionEvent(EYEWITNESS_GAME_ID, 'undo');
export const EYEWITNESS_SUBMIT_ARTWORK_EVENT = pluginActionEvent(
  EYEWITNESS_GAME_ID,
  'submit-artwork',
);
export const EYEWITNESS_CONFIRM_VOTE_EVENT = pluginActionEvent(EYEWITNESS_GAME_ID, 'confirm-vote');
export const EYEWITNESS_ADVANCE_EVENT = pluginActionEvent(EYEWITNESS_GAME_ID, 'advance');
export const EYEWITNESS_PHASE_CHANGED_EVENT = pluginActionEvent(
  EYEWITNESS_GAME_ID,
  'phase-changed',
);
export const EYEWITNESS_STATE_EVENT = pluginStateEvent(EYEWITNESS_GAME_ID);
