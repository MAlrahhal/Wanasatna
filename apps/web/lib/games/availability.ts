import type { AdminActionResponse, AdminGameAvailability, AdminGamesData } from '@wanasatna/shared';
import { PLAYABLE_GAME_IDS } from '@wanasatna/shared';
import { getServerUrl } from '@/lib/config/server-url';

export type PlayableAvailabilityMap = Record<string, boolean>;

export function defaultPlayableAvailability(): PlayableAvailabilityMap {
  return Object.fromEntries(PLAYABLE_GAME_IDS.map((gameId) => [gameId, true]));
}

function mapAvailability(games: AdminGameAvailability[] | undefined): PlayableAvailabilityMap {
  const next = defaultPlayableAvailability();
  for (const entry of games ?? []) {
    if (entry.gameId in next) {
      next[entry.gameId] = entry.isEnabled;
    }
  }
  return next;
}

export async function fetchPlayableGameAvailability(): Promise<PlayableAvailabilityMap> {
  try {
    const response = await fetch(`${getServerUrl()}/api/games/availability`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) {
      return defaultPlayableAvailability();
    }
    const body = (await response.json()) as AdminActionResponse<AdminGamesData>;
    if (!body.success || !body.data?.games) {
      return defaultPlayableAvailability();
    }
    return mapAvailability(body.data.games);
  } catch {
    return defaultPlayableAvailability();
  }
}
