import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const TIMELINE_PLACEMENT_GAME_ID = 'timeline-placement' as const;
export const TIMELINE_PLACEMENT_MIN_PLAYERS = 2;
export const TIMELINE_PLACEMENT_MAX_PLAYERS = 15;

export const TIMELINE_PLACEMENT_ROUND_OPTIONS = [5, 7, 10, 12] as const;
export const TIMELINE_PLACEMENT_SELECTION_OPTIONS = [20, 30, 45, 60] as const;
export const TIMELINE_PLACEMENT_PLACEMENTS_REVEAL_MS = 2_000;
export const TIMELINE_PLACEMENT_ANSWER_REVEAL_MS = 10_000;
export const TIMELINE_PLACEMENT_RESULTS_MS = 15_000;

export type TimelinePlacementSettings = {
  roundCount: (typeof TIMELINE_PLACEMENT_ROUND_OPTIONS)[number];
  selectionSeconds: (typeof TIMELINE_PLACEMENT_SELECTION_OPTIONS)[number];
};

export const TIMELINE_PLACEMENT_DEFAULT_SETTINGS: TimelinePlacementSettings = {
  roundCount: 7,
  selectionSeconds: 30,
};

export type TimelinePlacementPhase =
  'selecting' | 'placements-reveal' | 'answer-reveal' | 'completed';

export type TimelinePublicEvent = {
  id: string;
  text: string;
  year: number;
};

export type TimelineGap = {
  id: string;
  beforeEventId: string | null;
  afterEventId: string | null;
};

export type TimelinePlacementRevealEntry = {
  playerId: string;
  name: string;
  gapId: string;
  isCorrect: boolean | null;
  roundPoints: number | null;
};

export type TimelineLeaderboardEntry = {
  playerId: string;
  name: string;
  score: number;
  isDeparted: boolean;
};

export type TimelinePlacementLobbyView = {
  gameId: typeof TIMELINE_PLACEMENT_GAME_ID;
  settings: TimelinePlacementSettings;
  canEditSettings: boolean;
  participantCount: number;
  minPlayers: number;
  maxPlayers: number;
};

export type TimelinePlacementPlayerView = {
  gameId: typeof TIMELINE_PLACEMENT_GAME_ID;
  selfPlayerId: string;
  settings: TimelinePlacementSettings;
  phase: TimelinePlacementPhase;
  currentRound: number;
  totalRounds: number;
  roundId: string;
  timeline: TimelinePublicEvent[];
  candidate: { id: string; text: string } | null;
  availableGaps: TimelineGap[];
  ownGapId: string | null;
  submittedChoiceCount: number;
  eligiblePlayerCount: number;
  deadlineAtMs: number | null;
  remainingSeconds: number | null;
  placements: TimelinePlacementRevealEntry[];
  revealedAnswer: { event: TimelinePublicEvent; correctGapId: string } | null;
  leaderboard: TimelineLeaderboardEntry[];
  winnerPlayerIds: string[];
  isSpectator: boolean;
  isHost: boolean;
  canChoose: boolean;
  canAdvance: boolean;
  resultReason: 'round-complete' | 'match-complete' | 'insufficient-players' | null;
};

export type TimelinePlacementUpdateSettingsPayload = TimelinePlacementSettings;

export type TimelinePlacementChoosePayload = {
  roundId: string;
  gapId: string;
};

export type TimelinePlacementContinuePayload = {
  roundId: string;
};

export const TIMELINE_PLACEMENT_LOBBY_SYNC_EVENT = pluginActionEvent(
  TIMELINE_PLACEMENT_GAME_ID,
  'lobby-sync',
);
export const TIMELINE_PLACEMENT_UPDATE_SETTINGS_EVENT = pluginActionEvent(
  TIMELINE_PLACEMENT_GAME_ID,
  'update-settings',
);
export const TIMELINE_PLACEMENT_SYNC_EVENT = pluginActionEvent(TIMELINE_PLACEMENT_GAME_ID, 'sync');
export const TIMELINE_PLACEMENT_CHOOSE_EVENT = pluginActionEvent(
  TIMELINE_PLACEMENT_GAME_ID,
  'choose-gap',
);
export const TIMELINE_PLACEMENT_CONTINUE_EVENT = pluginActionEvent(
  TIMELINE_PLACEMENT_GAME_ID,
  'continue',
);
export const TIMELINE_PLACEMENT_PHASE_CHANGED_EVENT = pluginActionEvent(
  TIMELINE_PLACEMENT_GAME_ID,
  'phase-changed',
);
export const TIMELINE_PLACEMENT_STATE_EVENT = pluginStateEvent(TIMELINE_PLACEMENT_GAME_ID);
