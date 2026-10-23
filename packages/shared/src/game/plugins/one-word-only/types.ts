import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const ONE_WORD_ONLY_GAME_ID = 'one-word-only' as const;
export const ONE_WORD_ONLY_MIN_PLAYERS = 3;
export const ONE_WORD_ONLY_MAX_PLAYERS = 15;

/** Provisional closed-playtest values pending owner approval. */
export const ONE_WORD_ONLY_ROUND_OPTIONS = [3, 5, 7, 10] as const;
export const ONE_WORD_ONLY_CLUE_SECONDS_OPTIONS = [20, 30, 45, 60] as const;
export const ONE_WORD_ONLY_GUESS_SECONDS_OPTIONS = [20, 30, 45, 60] as const;

export type OneWordOnlySettings = {
  roundCount: (typeof ONE_WORD_ONLY_ROUND_OPTIONS)[number];
  clueSeconds: (typeof ONE_WORD_ONLY_CLUE_SECONDS_OPTIONS)[number];
  guessSeconds: (typeof ONE_WORD_ONLY_GUESS_SECONDS_OPTIONS)[number];
};

export const ONE_WORD_ONLY_DEFAULT_SETTINGS: OneWordOnlySettings = {
  roundCount: 5,
  clueSeconds: 30,
  guessSeconds: 30,
};

export type OneWordOnlyPhase = 'clue-writing' | 'guessing' | 'round-reveal' | 'completed';

export type OneWordOnlyLobbyView = {
  gameId: typeof ONE_WORD_ONLY_GAME_ID;
  settings: OneWordOnlySettings;
  canEditSettings: boolean;
  participantCount: number;
  minPlayers: number;
};

export type OneWordOnlyAnswerOption = { id: string; text: string };

export type OneWordOnlyRevealClue = {
  playerId: string;
  playerName: string;
  text: string;
  survived: boolean;
};

export type OneWordOnlyPlayerView = {
  gameId: typeof ONE_WORD_ONLY_GAME_ID;
  selfPlayerId: string;
  settings: OneWordOnlySettings;
  phase: OneWordOnlyPhase;
  currentRound: number;
  totalRounds: number;
  roundsPlayed: number;
  correctRoundCount: number;
  roundId: string;
  guesserPlayerId: string;
  guesserName: string;
  isGuesser: boolean;
  isSpectator: boolean;
  isHost: boolean;
  canSubmitClue: boolean;
  canConfirmAnswer: boolean;
  canAdvance: boolean;
  privateAnswer: string | null;
  ownSubmittedClue: string | null;
  submittedClueCount: number;
  eligibleClueWriterCount: number;
  survivingClues: string[];
  answerOptions: OneWordOnlyAnswerOption[];
  revealedCorrectAnswer: string | null;
  revealedSelectedAnswer: string | null;
  roundWasCorrect: boolean | null;
  revealClues: OneWordOnlyRevealClue[];
  deadlineAtMs: number | null;
  remainingSeconds: number | null;
  waitingForGuesser: boolean;
  resultReason: 'correct' | 'wrong' | 'no-answer' | 'guesser-left' | 'insufficient-players' | null;
};

export type OneWordOnlySubmitCluePayload = { roundId: string; clue: string };
export type OneWordOnlyConfirmAnswerPayload = {
  roundId: string;
  optionId: string;
  requestId: string;
};
export type OneWordOnlyAdvancePayload = { roundId: string; requestId: string };

export const ONE_WORD_ONLY_LOBBY_SYNC_EVENT = pluginActionEvent(
  ONE_WORD_ONLY_GAME_ID,
  'lobby-sync',
);
export const ONE_WORD_ONLY_UPDATE_SETTINGS_EVENT = pluginActionEvent(
  ONE_WORD_ONLY_GAME_ID,
  'update-settings',
);
export const ONE_WORD_ONLY_SYNC_EVENT = pluginActionEvent(ONE_WORD_ONLY_GAME_ID, 'sync');
export const ONE_WORD_ONLY_SUBMIT_CLUE_EVENT = pluginActionEvent(
  ONE_WORD_ONLY_GAME_ID,
  'submit-clue',
);
export const ONE_WORD_ONLY_CONFIRM_ANSWER_EVENT = pluginActionEvent(
  ONE_WORD_ONLY_GAME_ID,
  'confirm-answer',
);
export const ONE_WORD_ONLY_ADVANCE_EVENT = pluginActionEvent(ONE_WORD_ONLY_GAME_ID, 'advance');
export const ONE_WORD_ONLY_PHASE_CHANGED_EVENT = pluginActionEvent(
  ONE_WORD_ONLY_GAME_ID,
  'phase-changed',
);
export const ONE_WORD_ONLY_STATE_EVENT = pluginStateEvent(ONE_WORD_ONLY_GAME_ID);
