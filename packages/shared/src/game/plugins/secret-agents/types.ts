import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const SECRET_AGENTS_GAME_ID = 'secret-agents' as const;
export const SECRET_AGENTS_MIN_PLAYERS = 4;
export const SECRET_AGENTS_MAX_PLAYERS = 15;
export const SECRET_AGENTS_BOARD_SIZE = 25;

export const SECRET_AGENTS_CLUE_SECONDS_MIN = 15;
export const SECRET_AGENTS_CLUE_SECONDS_MAX = 300;
export const SECRET_AGENTS_OPERATIVE_SECONDS_MIN = 15;
export const SECRET_AGENTS_OPERATIVE_SECONDS_MAX = 300;
export const SECRET_AGENTS_BONUS_SECONDS_MIN = 0;
export const SECRET_AGENTS_BONUS_SECONDS_MAX = 60;

export type SecretAgentsTeam = 'red' | 'blue';
export type SecretAgentsRole = 'spymaster' | 'operative';
export type SecretAgentsCardType = SecretAgentsTeam | 'neutral' | 'assassin';
export type SecretAgentsClueValue = number | 'unlimited';
export type SecretAgentsPhase = 'clue' | 'guessing' | 'paused' | 'completed';

export type SecretAgentsSettings = {
  clueTimerEnabled: boolean;
  clueSeconds: number;
  operativeTimerEnabled: boolean;
  operativeSeconds: number;
  correctGuessBonusSeconds: number;
};

export const SECRET_AGENTS_DEFAULT_SETTINGS: SecretAgentsSettings = {
  clueTimerEnabled: false,
  clueSeconds: 90,
  operativeTimerEnabled: false,
  operativeSeconds: 60,
  correctGuessBonusSeconds: 10,
};

export type SecretAgentsAssignment = {
  team: SecretAgentsTeam;
  role: SecretAgentsRole;
  locked: boolean;
};

export type SecretAgentsRosterEntry = {
  playerId: string;
  name: string;
  isConnected: boolean;
  assignment: SecretAgentsAssignment | null;
};

export type SecretAgentsLobbyView = {
  gameId: typeof SECRET_AGENTS_GAME_ID;
  settings: SecretAgentsSettings;
  roster: SecretAgentsRosterEntry[];
  selfPlayerId: string;
  canEditSettings: boolean;
  canRandomize: boolean;
  canStart: boolean;
  validationMessage: string | null;
};

export type SecretAgentsPublicCard = {
  id: string;
  position: number;
  word: string;
  revealed: boolean;
  revealedType: SecretAgentsCardType | null;
  /** Present only for the viewer's own team during the active guessing phase. */
  nominations: Array<{ playerId: string; name: string }>;
};

export type SecretAgentsClue = {
  word: string;
  value: SecretAgentsClueValue;
  spymasterPlayerId: string;
  spymasterName: string;
};

export type SecretAgentsLogEntry = {
  id: string;
  turnNumber: number;
  team: SecretAgentsTeam;
  kind: 'turn' | 'clue' | 'guess' | 'pass' | 'timeout' | 'result';
  text: string;
  cardWord?: string;
  revealedType?: SecretAgentsCardType;
};

export type SecretAgentsPlayerView = {
  gameId: typeof SECRET_AGENTS_GAME_ID;
  selfPlayerId: string;
  phase: SecretAgentsPhase;
  activeTeam: SecretAgentsTeam;
  startingTeam: SecretAgentsTeam;
  turnNumber: number;
  turnId: string;
  settings: SecretAgentsSettings;
  roster: SecretAgentsRosterEntry[];
  selfAssignment: SecretAgentsAssignment | null;
  canAssignMidMatch: boolean;
  canSubmitClue: boolean;
  canNominate: boolean;
  canConfirm: boolean;
  canPass: boolean;
  clue: SecretAgentsClue | null;
  confirmedGuesses: number;
  maxConfirmedGuesses: number | null;
  remainingByTeam: Record<SecretAgentsTeam, number>;
  cards: SecretAgentsPublicCard[];
  /** Complete board key, emitted only in this player's private sync response. */
  secretKey: Record<string, SecretAgentsCardType> | null;
  deadlineAtMs: number | null;
  remainingSeconds: number | null;
  pausedFromPhase: 'clue' | 'guessing' | null;
  pauseReason: 'missing-spymaster' | 'missing-operative' | null;
  recoveryDeadlineAtMs: number | null;
  winnerTeam: SecretAgentsTeam | null;
  resultReason: 'agents-found' | 'assassin' | 'opponent-agent' | 'recovery-expired' | null;
  log: SecretAgentsLogEntry[];
};

export type SecretAgentsAssignPayload = {
  team: SecretAgentsTeam;
  role: SecretAgentsRole;
};

export type SecretAgentsUpdateSettingsPayload = Partial<SecretAgentsSettings>;

export type SecretAgentsSubmitCluePayload = {
  turnId: string;
  word: string;
  value: number | 'unlimited';
};

export type SecretAgentsCardActionPayload = {
  turnId: string;
  cardId: string;
  requestId: string;
};

export type SecretAgentsPassPayload = {
  turnId: string;
  requestId: string;
};

export const SECRET_AGENTS_LOBBY_SYNC_EVENT = pluginActionEvent(
  SECRET_AGENTS_GAME_ID,
  'lobby-sync',
);
export const SECRET_AGENTS_ASSIGN_EVENT = pluginActionEvent(SECRET_AGENTS_GAME_ID, 'assign');
export const SECRET_AGENTS_RANDOMIZE_EVENT = pluginActionEvent(SECRET_AGENTS_GAME_ID, 'randomize');
export const SECRET_AGENTS_UPDATE_SETTINGS_EVENT = pluginActionEvent(
  SECRET_AGENTS_GAME_ID,
  'update-settings',
);
export const SECRET_AGENTS_SYNC_EVENT = pluginActionEvent(SECRET_AGENTS_GAME_ID, 'sync');
export const SECRET_AGENTS_SUBMIT_CLUE_EVENT = pluginActionEvent(
  SECRET_AGENTS_GAME_ID,
  'submit-clue',
);
export const SECRET_AGENTS_TOGGLE_NOMINATION_EVENT = pluginActionEvent(
  SECRET_AGENTS_GAME_ID,
  'toggle-nomination',
);
export const SECRET_AGENTS_CONFIRM_CARD_EVENT = pluginActionEvent(
  SECRET_AGENTS_GAME_ID,
  'confirm-card',
);
export const SECRET_AGENTS_PASS_EVENT = pluginActionEvent(SECRET_AGENTS_GAME_ID, 'pass');
export const SECRET_AGENTS_PHASE_CHANGED_EVENT = pluginActionEvent(
  SECRET_AGENTS_GAME_ID,
  'phase-changed',
);
export const SECRET_AGENTS_STATE_EVENT = pluginStateEvent(SECRET_AGENTS_GAME_ID);
