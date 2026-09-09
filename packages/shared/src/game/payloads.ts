import type { GameShellState } from './state.js';

export type InitGameShellPayload = {
  gameId?: string | null;
  countdownSeconds?: number;
  gameTimerSeconds?: number;
};

export type SetGameShellReadyPayload = {
  isReady: boolean;
};

export type GameShellStatePayload = {
  state: GameShellState | null;
};

export type StartGameShellFromLobbyPayload = {
  gameId: string;
  /** Temporary lobby category selection until DB-backed settings land. */
  categoryId?: string | null;
  /** Timing Challenge lobby settings (ignored for other games). */
  timingChallenge?: {
    mode: 'guess-time' | 'stop-timer';
    rounds: number;
    minSeconds: number;
    maxSeconds: number;
  };
};

export type GameShellAbortReason = 'host_aborted' | 'insufficient_players';

export const INSUFFICIENT_PLAYERS_ABORT_MESSAGE =
  'تم إنهاء اللعبة لعدم توفر عدد كافٍ من اللاعبين.';

export type GameShellNavigatePayload = {
  path: '/game' | '/lobby' | '/marathon';
  roomId: string;
  roomCode?: string;
  reason?: GameShellAbortReason;
  message?: string;
};

export type GameShellPlayerRecoveryPayload = {
  isActive: boolean;
  remainingSeconds: number;
  connectedCount: number;
  minimumCount: number;
  sequence: number;
};
