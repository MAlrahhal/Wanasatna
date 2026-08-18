import { ADMIN_DASHBOARD_GAME_IDS } from '../admin/types.js';

/** Canonical playable game IDs. Missing GameAdminConfig row = enabled. */
export const PLAYABLE_GAME_IDS = ADMIN_DASHBOARD_GAME_IDS;

export type PlayableGameId = (typeof PLAYABLE_GAME_IDS)[number];

const PLAYABLE_GAME_ID_SET = new Set<string>(PLAYABLE_GAME_IDS);

export function isPlayableGameId(gameId: string): gameId is PlayableGameId {
  return PLAYABLE_GAME_ID_SET.has(gameId);
}

export const GAME_DISABLED_MESSAGE = 'هذه اللعبة غير متاحة حالياً.';

export type GameAvailabilityEntry = {
  gameId: string;
  isEnabled: boolean;
};

export type GameAvailabilityData = {
  games: GameAvailabilityEntry[];
};
