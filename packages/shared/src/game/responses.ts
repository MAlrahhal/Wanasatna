import type { GameError } from './errors.js';
import type { GameShellState } from './state.js';

export type GameSuccessResponse<T> = {
  success: true;
  data: T;
};

export type GameErrorResponse = {
  success: false;
  error: GameError;
};

export type GameActionResponse<T> = GameSuccessResponse<T> | GameErrorResponse;

export type InitGameShellResponse = GameActionResponse<{ state: GameShellState }>;

export type GameShellStateResponse = GameActionResponse<{ state: GameShellState | null }>;

export type StartGameShellFromLobbyResponse = GameActionResponse<{ state: GameShellState }>;

export type ReturnGameShellToLobbyResponse = GameActionResponse<{ path: '/lobby' }>;
