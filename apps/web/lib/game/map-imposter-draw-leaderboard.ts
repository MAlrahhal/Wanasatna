import type { ImposterDrawPlayerView } from '@wanasatna/shared';
import type { LobbyPlayer } from '@/lib/lobby/types';
import type { GameLeaderboardEntry } from '@/lib/game/shell-types';
import { compareByScoreThenName } from '@/lib/game/leaderboard-sort';

export function mapImposterDrawLeaderboard(
  view: ImposterDrawPlayerView | null,
  currentPlayerId: string,
  roomPlayers: LobbyPlayer[],
): GameLeaderboardEntry[] {
  const participants = roomPlayers.filter((player) => !player.isSpectator);
  const scoreByPlayerId = new Map<string, number>();
  const nameByPlayerId = new Map<string, string>();

  if (view?.resultsLeaderboard.length) {
    for (const entry of view.resultsLeaderboard) {
      scoreByPlayerId.set(entry.playerId, entry.totalPoints);
      nameByPlayerId.set(entry.playerId, entry.name);
    }
  } else if (view?.leaderboard.length) {
    for (const entry of view.leaderboard) {
      scoreByPlayerId.set(entry.playerId, entry.score);
      nameByPlayerId.set(entry.playerId, entry.name);
    }
  }

  return [...participants]
    .map((player) => ({
      playerId: player.id,
      name: nameByPlayerId.get(player.id) ?? player.name,
      score: scoreByPlayerId.get(player.id) ?? 0,
      isCurrentPlayer: player.id === currentPlayerId,
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
