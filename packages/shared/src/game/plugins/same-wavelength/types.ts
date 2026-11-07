import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const SAME_WAVELENGTH_GAME_ID = 'same-wavelength' as const;
export const SAME_WAVELENGTH_MIN_PLAYERS = 3;
export const SAME_WAVELENGTH_TEAM_MIN_PLAYERS = 4;
export const SAME_WAVELENGTH_MAX_PLAYERS = 15;
export const SAME_WAVELENGTH_CLUE_SECONDS = 40;
export const SAME_WAVELENGTH_GUESS_SECONDS = 40;
export const SAME_WAVELENGTH_INDIVIDUAL_ROUNDS = 5;
export const SAME_WAVELENGTH_TEAM_ROUNDS = 3;

export type SameWavelengthMode = 'individual' | 'team';
export type SameWavelengthTeam = 'red' | 'blue';
export type SameWavelengthRole = 'clue-giver' | 'guesser';
export type SameWavelengthPhase = 'clue-writing' | 'guessing' | 'turn-results' | 'completed';

export type SameWavelengthSettings = {
  mode: SameWavelengthMode;
  roundCount: number;
  clueSeconds: number;
  guessingSeconds: number;
};

export const SAME_WAVELENGTH_DEFAULT_SETTINGS: SameWavelengthSettings = {
  mode: 'individual',
  roundCount: SAME_WAVELENGTH_INDIVIDUAL_ROUNDS,
  clueSeconds: SAME_WAVELENGTH_CLUE_SECONDS,
  guessingSeconds: SAME_WAVELENGTH_GUESS_SECONDS,
};

export type SameWavelengthAssignment = {
  team: SameWavelengthTeam;
  role: SameWavelengthRole;
};

export type SameWavelengthRosterEntry = {
  playerId: string;
  name: string;
  isConnected: boolean;
  assignment: SameWavelengthAssignment | null;
};

export type SameWavelengthLobbyView = {
  gameId: typeof SAME_WAVELENGTH_GAME_ID;
  settings: SameWavelengthSettings;
  roster: SameWavelengthRosterEntry[];
  selfPlayerId: string;
  canEditSettings: boolean;
  canStart: boolean;
  validationMessage: string | null;
};

export type SameWavelengthProposalView = {
  playerId: string;
  name: string;
  position: number;
  confirmed: boolean;
};

export type SameWavelengthResultEntry = {
  playerId: string;
  name: string;
  guess: number | null;
  distance: number | null;
  closeness: number | null;
  points: number;
  totalPoints: number;
};

export type SameWavelengthLeaderboardEntry = {
  playerId: string;
  name: string;
  score: number;
  isWinner: boolean;
};

export type SameWavelengthTeamSummary = {
  team: SameWavelengthTeam;
  score: number;
  memberNames: string[];
  isWinner: boolean;
};

export type SameWavelengthPlayerView = {
  gameId: typeof SAME_WAVELENGTH_GAME_ID;
  selfPlayerId: string;
  matchId: string;
  turnId: string;
  mode: SameWavelengthMode;
  phase: SameWavelengthPhase;
  settings: SameWavelengthSettings;
  currentRound: number;
  totalRounds: number;
  activeTeam: SameWavelengthTeam | null;
  teamTurnNumber: 1 | 2 | null;
  leftLabel: string;
  rightLabel: string;
  clueGiverPlayerId: string | null;
  clueGiverName: string | null;
  selfAssignment: SameWavelengthAssignment | null;
  isSpectator: boolean;
  isClueGiver: boolean;
  canSubmitClue: boolean;
  canPropose: boolean;
  canConfirm: boolean;
  canAdvance: boolean;
  clue: string | null;
  privateTarget: number | null;
  revealedTarget: number | null;
  ownProposal: number | null;
  ownConfirmed: boolean;
  teamProposals: SameWavelengthProposalView[];
  agreedGuess: number | null;
  turnDistance: number | null;
  turnCloseness: number | null;
  turnPoints: number | null;
  deadlineAtMs: number | null;
  remainingSeconds: number | null;
  roundResults: SameWavelengthResultEntry[];
  leaderboard: SameWavelengthLeaderboardEntry[];
  teamSummaries: SameWavelengthTeamSummary[];
  completedNormally: boolean | null;
  resultReason: 'scored' | 'no-clue' | 'no-consensus' | 'interrupted' | null;
};

export type SameWavelengthAssignPayload = SameWavelengthAssignment;
export type SameWavelengthUpdateSettingsPayload = { mode: SameWavelengthMode };
export type SameWavelengthSubmitCluePayload = {
  turnId: string;
  clue: string;
  requestId: string;
};
export type SameWavelengthProposalPayload = {
  turnId: string;
  position: number;
  requestId: string;
};
export type SameWavelengthConfirmPayload = { turnId: string; requestId: string };
export type SameWavelengthNextPayload = { turnId: string; requestId: string };

export const SAME_WAVELENGTH_LOBBY_SYNC_EVENT = pluginActionEvent(
  SAME_WAVELENGTH_GAME_ID,
  'lobby-sync',
);
export const SAME_WAVELENGTH_UPDATE_SETTINGS_EVENT = pluginActionEvent(
  SAME_WAVELENGTH_GAME_ID,
  'update-settings',
);
export const SAME_WAVELENGTH_ASSIGN_EVENT = pluginActionEvent(SAME_WAVELENGTH_GAME_ID, 'assign');
export const SAME_WAVELENGTH_SYNC_EVENT = pluginActionEvent(SAME_WAVELENGTH_GAME_ID, 'sync');
export const SAME_WAVELENGTH_SUBMIT_CLUE_EVENT = pluginActionEvent(
  SAME_WAVELENGTH_GAME_ID,
  'submit-clue',
);
export const SAME_WAVELENGTH_PROPOSE_EVENT = pluginActionEvent(SAME_WAVELENGTH_GAME_ID, 'propose');
export const SAME_WAVELENGTH_CONFIRM_EVENT = pluginActionEvent(SAME_WAVELENGTH_GAME_ID, 'confirm');
export const SAME_WAVELENGTH_NEXT_EVENT = pluginActionEvent(SAME_WAVELENGTH_GAME_ID, 'next');
export const SAME_WAVELENGTH_PHASE_CHANGED_EVENT = pluginActionEvent(
  SAME_WAVELENGTH_GAME_ID,
  'phase-changed',
);
export const SAME_WAVELENGTH_STATE_EVENT = pluginStateEvent(SAME_WAVELENGTH_GAME_ID);
