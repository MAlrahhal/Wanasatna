import type {
  DrawGuessLeaderboardEntry,
  DrawGuessMatchState,
  DrawGuessRoundResultEntry,
} from '@wanasatna/shared';

export const DRAW_GUESS_CORRECT_GUESS_POINTS = 100;

export function computePlayerRoundPoints(
  match: DrawGuessMatchState,
  playerId: string,
): number {
  if (!match.round.guessedCorrectly) {
    return 0;
  }

  if (playerId === match.round.correctGuesserPlayerId) {
    return DRAW_GUESS_CORRECT_GUESS_POINTS;
  }

  if (playerId === match.round.drawerPlayerId) {
    return DRAW_GUESS_CORRECT_GUESS_POINTS;
  }

  return 0;
}

export function applyRoundScores(match: DrawGuessMatchState): DrawGuessMatchState {
  if (!match.round.guessedCorrectly) {
    return match;
  }

  const nextScores = { ...match.scores };
  const drawerId = match.round.drawerPlayerId;
  const guesserId = match.round.correctGuesserPlayerId;

  if (guesserId) {
    nextScores[guesserId] = (nextScores[guesserId] ?? 0) + DRAW_GUESS_CORRECT_GUESS_POINTS;
  }

  nextScores[drawerId] = (nextScores[drawerId] ?? 0) + DRAW_GUESS_CORRECT_GUESS_POINTS;

  return {
    ...match,
    scores: nextScores,
  };
}

export function buildRoundResultEntries(
  match: DrawGuessMatchState,
): DrawGuessRoundResultEntry[] {
  return match.playerIds.map((playerId) => {
    const roundPoints = computePlayerRoundPoints(match, playerId);

    return {
      playerId,
      name: match.playerNames[playerId] ?? 'لاعب',
      roundPoints,
      totalPoints: match.scores[playerId] ?? 0,
      isDrawer: playerId === match.round.drawerPlayerId,
      isCorrectGuesser: playerId === match.round.correctGuesserPlayerId,
    };
  });
}

export function buildLeaderboardEntries(
  match: DrawGuessMatchState,
): DrawGuessLeaderboardEntry[] {
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

export function buildResultsLeaderboardEntries(match: DrawGuessMatchState): Array<{
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
