import type { BaraAlSalafaPlayerView } from '@wanasatna/shared';
import type { LobbyPlayer } from '@/lib/lobby/types';
import type { GameLeaderboardEntry } from '@/lib/game/shell-types';
import { mapLockedMatchLeaderboard } from '@/lib/game/map-locked-match-leaderboard';

/** Maps locked match participants + authoritative Bara scores into shell leaderboard rows. */
export function mapBaraAlSalafaLeaderboard(
  view: BaraAlSalafaPlayerView | null,
  currentPlayerId: string,
  roomPlayers: LobbyPlayer[],
): GameLeaderboardEntry[] {
  return mapLockedMatchLeaderboard(view, currentPlayerId, roomPlayers);
}
