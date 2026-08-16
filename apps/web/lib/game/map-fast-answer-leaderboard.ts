import type { FastAnswerPlayerView } from '@wanasatna/shared';
import type { LobbyPlayer } from '@/lib/lobby/types';
import type { GameLeaderboardEntry } from '@/lib/game/shell-types';
import { mapLockedMatchLeaderboard } from '@/lib/game/map-locked-match-leaderboard';

export function mapFastAnswerLeaderboard(
  view: FastAnswerPlayerView | null,
  currentPlayerId: string,
  roomPlayers: LobbyPlayer[],
): GameLeaderboardEntry[] {
  return mapLockedMatchLeaderboard(view, currentPlayerId, roomPlayers);
}
