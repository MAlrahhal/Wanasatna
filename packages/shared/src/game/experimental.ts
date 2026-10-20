import type { GameActionResponse } from './responses.js';

export const SELECT_EXPERIMENTAL_GAME_EVENT = 'experimental-game-select' as const;
export const EXPERIMENTAL_GAME_SELECTED_EVENT = 'experimental-game-selected' as const;

export type ExperimentalGameSummary = {
  gameId: string;
  title: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
};

export type AdminExperimentalGamesData = {
  enabled: boolean;
  games: ExperimentalGameSummary[];
};

export type SelectExperimentalGamePayload = {
  gameId: string;
};

export type ExperimentalGameSelectedPayload = {
  roomId: string;
  gameId: string | null;
};

export type SelectExperimentalGameResponse = GameActionResponse<ExperimentalGameSelectedPayload>;
