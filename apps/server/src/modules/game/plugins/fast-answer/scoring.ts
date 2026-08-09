import type {
  FastAnswerLeaderboardEntry,
  FastAnswerMatchState,
  FastAnswerRoundResultEntry,
} from '@wanasatna/shared';
import { FAST_ANSWER_WINNER_POINTS } from '@wanasatna/shared';

export function computePlayerRoundPoints(
  match: FastAnswerMatchState,
  playerId: string,
): number {
  if (match.round.winnerPlayerId === playerId) {
    return FAST_ANSWER_WINNER_POINTS;
  }

  return 0;
}

export function applyRoundScores(match: FastAnswerMatchState): FastAnswerMatchState {
  const winnerId = match.round.winnerPlayerId;

  if (!winnerId) {
    return match;
  }

  return {
    ...match,
    scores: {
      ...match.scores,
      [winnerId]: (match.scores[winnerId] ?? 0) + FAST_ANSWER_WINNER_POINTS,
    },
  };
}

export function buildRoundResultEntries(
  match: FastAnswerMatchState,
): FastAnswerRoundResultEntry[] {
  return match.playerIds.map((playerId) => ({
    playerId,
    name: match.playerNames[playerId] ?? 'لاعب',
    roundPoints: computePlayerRoundPoints(match, playerId),
    totalPoints: match.scores[playerId] ?? 0,
    isWinner: match.round.winnerPlayerId === playerId,
  }));
}

export function buildLeaderboardEntries(
  match: FastAnswerMatchState,
): FastAnswerLeaderboardEntry[] {
  const playerOrder = new Map(match.playerIds.map((playerId, index) => [playerId, index]));

  return [...match.playerIds]
    .sort((leftPlayerId, rightPlayerId) => {
      const scoreDifference =
        (match.scores[rightPlayerId] ?? 0) - (match.scores[leftPlayerId] ?? 0);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return (playerOrder.get(leftPlayerId) ?? 0) - (playerOrder.get(rightPlayerId) ?? 0);
    })
    .map((playerId) => ({
      playerId,
      name: match.playerNames[playerId] ?? 'لاعب',
      score: match.scores[playerId] ?? 0,
    }));
}

export function buildResultsLeaderboardEntries(match: FastAnswerMatchState): Array<{
  playerId: string;
  name: string;
  totalPoints: number;
  rank: number;
  isFirstPlace: boolean;
}> {
  const sortedEntries = buildLeaderboardEntries(match);
  let previousRank = 1;

  return sortedEntries.map((entry, index) => {
    const rank =
      index > 0 && entry.score === sortedEntries[index - 1]!.score ? previousRank : index + 1;

    previousRank = rank;

    return {
      playerId: entry.playerId,
      name: entry.name,
      totalPoints: entry.score,
      rank,
      isFirstPlace: rank === 1,
    };
  });
}
