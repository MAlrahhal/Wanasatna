import type { LobbyPlayer } from '@/lib/lobby/types';
import type { GameLeaderboardEntry } from '@/lib/game/shell-types';
import { compareByScoreThenName } from '@/lib/game/leaderboard-sort';

export type LockedMatchScoreView = {
  leaderboard?: ReadonlyArray<{ playerId: string; name: string; score: number }>;
  resultsLeaderboard?: ReadonlyArray<{ playerId: string; name: string; totalPoints: number }>;
} | null;

/** Rows come from locked match scores, not the live room roster. */
export function mapLockedMatchLeaderboard(
  view: LockedMatchScoreView,
  currentPlayerId: string,
  roomPlayers: LobbyPlayer[],
): GameLeaderboardEntry[] {
  if (!view) {
    return [];
  }

  const scoreByPlayerId = new Map<string, number>();
  const nameByPlayerId = new Map<string, string>();
  const rowIds: string[] = [];

  if (view.resultsLeaderboard?.length) {
    for (const entry of view.resultsLeaderboard) {
      if (scoreByPlayerId.has(entry.playerId)) {
        continue;
      }

      rowIds.push(entry.playerId);
      scoreByPlayerId.set(entry.playerId, entry.totalPoints);
      nameByPlayerId.set(entry.playerId, entry.name);
    }
  } else if (view.leaderboard?.length) {
    for (const entry of view.leaderboard) {
      if (scoreByPlayerId.has(entry.playerId)) {
        continue;
      }

      rowIds.push(entry.playerId);
      scoreByPlayerId.set(entry.playerId, entry.score);
      nameByPlayerId.set(entry.playerId, entry.name);
    }
  } else {
    return [];
  }

  const roomNameById = new Map(roomPlayers.map((player) => [player.id, player.name]));

  return rowIds
    .map((playerId) => ({
      playerId,
      name: nameByPlayerId.get(playerId) ?? roomNameById.get(playerId) ?? 'لاعب',
      score: scoreByPlayerId.get(playerId) ?? 0,
      isCurrentPlayer: playerId === currentPlayerId,
    }))
    .sort((left, right) =>
      compareByScoreThenName(
        { score: left.score, name: left.name, playerId: left.playerId },
        { score: right.score, name: right.name, playerId: right.playerId },
      ),
    )
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}
