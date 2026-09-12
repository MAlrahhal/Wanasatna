import type {
  FastAnswerLeaderboardEntry,
  FastAnswerMatchState,
  FastAnswerRoundResultEntry,
} from '@wanasatna/shared';
import { FAST_ANSWER_WINNER_POINTS } from '@wanasatna/shared';

const PLACEMENT_POINTS = [FAST_ANSWER_WINNER_POINTS, 75, 50] as const;
const LATER_PLACEMENT_POINTS = 25;

export function pointsForCorrectPlacement(placement: number): number {
  if (!Number.isInteger(placement) || placement < 1) {
    return 0;
  }

  return PLACEMENT_POINTS[placement - 1] ?? LATER_PLACEMENT_POINTS;
}

export function correctAnswerPlacement(
  match: FastAnswerMatchState,
  playerId: string,
): number | null {
  const index = match.round.correctAnswerPlayerIds.indexOf(playerId);
  return index === -1 ? null : index + 1;
}

export function computePlayerRoundPoints(match: FastAnswerMatchState, playerId: string): number {
  const placement = correctAnswerPlacement(match, playerId);
  return placement === null ? 0 : pointsForCorrectPlacement(placement);
}

export function applyRoundScores(match: FastAnswerMatchState): FastAnswerMatchState {
  if (match.round.correctAnswerPlayerIds.length === 0) {
    return match;
  }

  const scores = { ...match.scores };

  match.round.correctAnswerPlayerIds.forEach((playerId, index) => {
    scores[playerId] = (scores[playerId] ?? 0) + pointsForCorrectPlacement(index + 1);
  });

  return {
    ...match,
    scores,
  };
}

export function buildRoundResultEntries(match: FastAnswerMatchState): FastAnswerRoundResultEntry[] {
  return match.playerIds.map((playerId) => {
    const placement = correctAnswerPlacement(match, playerId);

    return {
      playerId,
      name: match.playerNames[playerId] ?? 'لاعب',
      roundPoints: computePlayerRoundPoints(match, playerId),
      totalPoints: match.scores[playerId] ?? 0,
      placement,
      isWinner: placement === 1,
    };
  });
}

export function buildLeaderboardEntries(match: FastAnswerMatchState): FastAnswerLeaderboardEntry[] {
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
