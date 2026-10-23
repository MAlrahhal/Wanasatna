import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const EMOJI_LANGUAGE_GAME_ID = 'emoji-language' as const;
export const EMOJI_LANGUAGE_MIN_PLAYERS = 2;
export const EMOJI_LANGUAGE_MAX_PLAYERS = 15;

export const EMOJI_LANGUAGE_ROUND_OPTIONS = [3, 5, 7, 10] as const;
export const EMOJI_LANGUAGE_PREPARATION_OPTIONS = [30, 45, 60] as const;
export const EMOJI_LANGUAGE_GUESSING_OPTIONS = [30, 45, 60, 90] as const;

export type EmojiLanguageMode = 'player-clue' | 'server-puzzle';
export type EmojiLanguagePhase = 'preparation' | 'guessing' | 'round-results' | 'completed';

export type EmojiLanguageSettings = {
  mode: EmojiLanguageMode;
  roundCount: (typeof EMOJI_LANGUAGE_ROUND_OPTIONS)[number];
  preparationSeconds: (typeof EMOJI_LANGUAGE_PREPARATION_OPTIONS)[number];
  guessingSeconds: (typeof EMOJI_LANGUAGE_GUESSING_OPTIONS)[number];
};

export const EMOJI_LANGUAGE_DEFAULT_SETTINGS: EmojiLanguageSettings = {
  mode: 'player-clue',
  roundCount: 5,
  preparationSeconds: 45,
  guessingSeconds: 45,
};

/** Curated in-app picker. The server accepts only exact tokens from this list. */
export const EMOJI_LANGUAGE_PICKER = [
  '😀',
  '😂',
  '😍',
  '😎',
  '🤔',
  '😴',
  '😭',
  '😱',
  '🤫',
  '👏',
  '👀',
  '❤️',
  '💔',
  '🔥',
  '⭐',
  '☀️',
  '🌙',
  '🌧️',
  '☔',
  '🌊',
  '🏜️',
  '🌴',
  '🐪',
  '🦁',
  '🐠',
  '🐈',
  '🐕',
  '👑',
  '👦',
  '👧',
  '👨‍👩‍👧‍👦',
  '🏠',
  '🏫',
  '🏥',
  '🏟️',
  '🚗',
  '🚕',
  '🚙',
  '🚦',
  '✈️',
  '🚀',
  '🧳',
  '⚽',
  '🏆',
  '🎂',
  '🎈',
  '🎉',
  '🎬',
  '🔎',
  '💡',
  '📚',
  '✏️',
  '📝',
  '📱',
  '⏰',
  '🛏️',
  '🍳',
  '☕',
  '🍿',
  '🍕',
  '🍎',
  '🌕',
] as const;

export type EmojiLanguageLobbyView = {
  gameId: typeof EMOJI_LANGUAGE_GAME_ID;
  settings: EmojiLanguageSettings;
  canEditSettings: boolean;
  participantCount: number;
  minPlayers: number;
};

export type EmojiLanguageRoundResultEntry = {
  playerId: string;
  name: string;
  placement: number | null;
  roundPoints: number;
  totalPoints: number;
  isWriter: boolean;
};

export type EmojiLanguageLeaderboardEntry = {
  playerId: string;
  name: string;
  score: number;
};

export type EmojiLanguagePlayerView = {
  gameId: typeof EMOJI_LANGUAGE_GAME_ID;
  selfPlayerId: string;
  mode: EmojiLanguageMode;
  settings: EmojiLanguageSettings;
  phase: EmojiLanguagePhase;
  currentRound: number;
  totalRounds: number;
  roundId: string;
  writerPlayerId: string | null;
  writerName: string | null;
  isWriter: boolean;
  isSpectator: boolean;
  canSubmitClue: boolean;
  canGuess: boolean;
  privateAnswer: string | null;
  revealedAnswer: string | null;
  clue: string[] | null;
  deadlineAtMs: number | null;
  remainingSeconds: number | null;
  ownAttemptCount: number;
  ownCorrect: boolean;
  ownPlacement: number | null;
  correctAnswerCount: number;
  roundResults: EmojiLanguageRoundResultEntry[];
  leaderboard: EmojiLanguageLeaderboardEntry[];
  resultReason: 'answered' | 'no-correct-answer' | 'no-clue' | 'insufficient-players' | null;
};

export type EmojiLanguageUpdateSettingsPayload = EmojiLanguageSettings;

export type EmojiLanguageSubmitCluePayload = {
  roundId: string;
  emojis: string[];
};

export type EmojiLanguageSubmitGuessPayload = {
  roundId: string;
  answer: string;
  requestId: string;
};

export type EmojiLanguageGuessFeedback = {
  correct: boolean;
  placement: number | null;
  cooldownMs: number;
};

export const EMOJI_LANGUAGE_LOBBY_SYNC_EVENT = pluginActionEvent(
  EMOJI_LANGUAGE_GAME_ID,
  'lobby-sync',
);
export const EMOJI_LANGUAGE_UPDATE_SETTINGS_EVENT = pluginActionEvent(
  EMOJI_LANGUAGE_GAME_ID,
  'update-settings',
);
export const EMOJI_LANGUAGE_SYNC_EVENT = pluginActionEvent(EMOJI_LANGUAGE_GAME_ID, 'sync');
export const EMOJI_LANGUAGE_SUBMIT_CLUE_EVENT = pluginActionEvent(
  EMOJI_LANGUAGE_GAME_ID,
  'submit-clue',
);
export const EMOJI_LANGUAGE_SUBMIT_GUESS_EVENT = pluginActionEvent(
  EMOJI_LANGUAGE_GAME_ID,
  'submit-guess',
);
export const EMOJI_LANGUAGE_PHASE_CHANGED_EVENT = pluginActionEvent(
  EMOJI_LANGUAGE_GAME_ID,
  'phase-changed',
);
export const EMOJI_LANGUAGE_STATE_EVENT = pluginStateEvent(EMOJI_LANGUAGE_GAME_ID);
