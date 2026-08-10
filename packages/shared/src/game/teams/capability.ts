import { GUESSING_CHALLENGE_GAME_ID } from '../plugins/guessing-challenge/types.js';
import type { GameTeamCapability } from './types.js';

export const GUESSING_CHALLENGE_TEAM_CAPABILITY: GameTeamCapability = {
  enabled: true,
  teamIds: ['blue', 'red'],
  capacityByMode: {
    '1v1': 1,
    '2v2': 2,
  },
  defaultMode: '1v1',
};

/** Opt-in lookup — returns null for non-team games. */
export function getGameTeamCapability(gameId: string): GameTeamCapability | null {
  if (gameId === GUESSING_CHALLENGE_GAME_ID) {
    return GUESSING_CHALLENGE_TEAM_CAPABILITY;
  }
  return null;
}

export function resolveTeamCapacity(capability: GameTeamCapability, mode: string): number {
  return capability.capacityByMode[mode] ?? capability.capacityByMode[capability.defaultMode] ?? 1;
}
