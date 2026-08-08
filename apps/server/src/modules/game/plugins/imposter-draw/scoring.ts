import type {
  ImposterDrawLeaderboardEntry,
  ImposterDrawMatchState,
  ImposterDrawRoundResultEntry,
} from '@wanasatna/shared';

export const IMPOSTER_DRAW_POINTS = 100;

export function computePlayerRoundPoints(
  match: ImposterDrawMatchState,
  playerId: string,
): number {
  const round = match.round;
  let points = 0;

  if (playerId === round.impostorPlayerId) {
    if (round.impostorVotedOut === false) {
      points += IMPOSTER_DRAW_POINTS;
    }

    if (round.impostorGuessedCorrectly) {
      points += IMPOSTER_DRAW_POINTS;
    }

    return points;
  }

  if (round.votes[playerId] === round.impostorPlayerId) {
    points += IMPOSTER_DRAW_POINTS;
  }

  return points;
}

export function applyRoundScores(match: ImposterDrawMatchState): ImposterDrawMatchState {
  const nextScores = { ...match.scores };

  for (const playerId of match.playerIds) {
    nextScores[playerId] =
      (nextScores[playerId] ?? 0) + computePlayerRoundPoints(match, playerId);
  }

  return {
    ...match,
    scores: nextScores,
  };
}

export function didPlayersWin(match: ImposterDrawMatchState): boolean {
  if (match.round.impostorVotedOut) {
    return true;
  }

  return match.round.impostorGuessedCorrectly !== true;
}

export function buildRoundResultEntries(
  match: ImposterDrawMatchState,
): ImposterDrawRoundResultEntry[] {
  return match.playerIds.map((playerId) => ({
    playerId,
    name: match.playerNames[playerId] ?? 'لاعب',
    roundPoints: computePlayerRoundPoints(match, playerId),
    totalPoints: match.scores[playerId] ?? 0,
    isImpostor: playerId === match.round.impostorPlayerId,
    votedCorrectly: match.round.votes[playerId] === match.round.impostorPlayerId,
  }));
}

export function buildLeaderboardEntries(
  match: ImposterDrawMatchState,
): ImposterDrawLeaderboardEntry[] {
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

export function buildResultsLeaderboardEntries(match: ImposterDrawMatchState): Array<{
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
