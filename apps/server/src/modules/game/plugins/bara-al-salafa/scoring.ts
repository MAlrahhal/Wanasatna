import type { BaraAlSalafaLeaderboardEntry, BaraAlSalafaMatchState, BaraAlSalafaResultsLeaderboardEntry, BaraAlSalafaRoundResultEntry } from '@wanasatna/shared';
import { BARA_AL_SALAFA_ROUND_SCORE_POINTS } from '@wanasatna/shared';

export function computePlayerRoundPoints(
  match: BaraAlSalafaMatchState,
  playerId: string,
): number {
  const impostorPlayerId = match.round.impostorPlayerId;

  if (playerId === impostorPlayerId) {
    return match.round.guessedCorrectly === true ? BARA_AL_SALAFA_ROUND_SCORE_POINTS : 0;
  }

  return match.round.votes[playerId] === impostorPlayerId ? BARA_AL_SALAFA_ROUND_SCORE_POINTS : 0;
}

export function buildRoundResultEntries(match: BaraAlSalafaMatchState): BaraAlSalafaRoundResultEntry[] {
  return match.playerIds.map((playerId) => {
    const roundPoints = computePlayerRoundPoints(match, playerId);

    return {
      playerId,
      name: match.playerNames[playerId] ?? 'لاعب',
      roundPoints,
      totalPoints: match.scores[playerId] ?? 0,
      isImpostor: playerId === match.round.impostorPlayerId,
      earnedPoints: roundPoints > 0,
    };
  });
}

export function buildResultsLeaderboardEntries(
  match: BaraAlSalafaMatchState,
): BaraAlSalafaResultsLeaderboardEntry[] {
  const sortedEntries = buildLeaderboardEntries(match);
  let previousRank = 1;

  return sortedEntries.map((entry, index) => {
    const rank =
      index > 0 && entry.score === sortedEntries[index - 1]!.score
        ? previousRank
        : index + 1;

    previousRank = rank;

    return {
      playerId: entry.playerId,
      name: entry.name,
      totalPoints: entry.score,
      rank,
      isFirstPlace: entry.isFirstPlace,
    };
  });
}

export function applyRoundScores(match: BaraAlSalafaMatchState): BaraAlSalafaMatchState {
  const impostorPlayerId = match.round.impostorPlayerId;
  const nextScores = { ...match.scores };

  for (const playerId of match.playerIds) {
    if (playerId === impostorPlayerId) {
      if (match.round.guessedCorrectly === true) {
        nextScores[playerId] = (nextScores[playerId] ?? 0) + BARA_AL_SALAFA_ROUND_SCORE_POINTS;
      }
      continue;
    }

    if (match.round.votes[playerId] === impostorPlayerId) {
      nextScores[playerId] = (nextScores[playerId] ?? 0) + BARA_AL_SALAFA_ROUND_SCORE_POINTS;
    }
  }

  return {
    ...match,
    scores: nextScores,
  };
}

export function buildLeaderboardEntries(match: BaraAlSalafaMatchState): BaraAlSalafaLeaderboardEntry[] {
  const playerOrder = new Map(match.playerIds.map((playerId, index) => [playerId, index]));
  const maxScore = Math.max(...match.playerIds.map((playerId) => match.scores[playerId] ?? 0));

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
      isFirstPlace: (match.scores[playerId] ?? 0) === maxScore,
    }));
}
