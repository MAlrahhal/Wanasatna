import type {
  TimingChallengeLeaderboardEntry,
  TimingChallengeMatchState,
  TimingChallengeRoundResultEntry,
} from '@wanasatna/shared';

const PLACEMENT_POINTS = [100, 75, 50] as const;
const DEFAULT_POINTS = 25;

export function compareArabicNames(left: string, right: string): number {
  return left.localeCompare(right, 'ar', { sensitivity: 'base' });
}

export function placementPoints(placement: number): number {
  if (placement <= 0) {
    return 0;
  }

  if (placement <= PLACEMENT_POINTS.length) {
    return PLACEMENT_POINTS[placement - 1]!;
  }

  return DEFAULT_POINTS;
}

function absoluteErrorMs(match: TimingChallengeMatchState, playerId: string): number | null {
  const state = match.round.playerStates[playerId];

  if (!state) {
    return null;
  }

  if (match.settings.mode === 'guess-time') {
    return state.guessMs === null ? null : Math.abs(state.guessMs - match.round.targetMs);
  }

  return state.errorMs;
}

export function computeRoundPlacements(match: TimingChallengeMatchState): Array<{
  playerId: string;
  errorMs: number | null;
  placement: number;
  isTied: boolean;
  roundPoints: number;
}> {
  const ranked = match.playerIds
    .map((playerId) => ({
      playerId,
      errorMs: absoluteErrorMs(match, playerId),
      name: match.playerNames[playerId] ?? 'لاعب',
    }))
    .sort((left, right) => {
      if (left.errorMs === null && right.errorMs === null) {
        return compareArabicNames(left.name, right.name);
      }

      if (left.errorMs === null) {
        return 1;
      }

      if (right.errorMs === null) {
        return -1;
      }

      if (left.errorMs !== right.errorMs) {
        return left.errorMs - right.errorMs;
      }

      return compareArabicNames(left.name, right.name);
    });

  let previousPlacement = 1;
  let previousError: number | null | undefined;

  return ranked.map((entry, index) => {
    const placement =
      index > 0 && entry.errorMs !== null && entry.errorMs === previousError
        ? previousPlacement
        : index + 1;

    previousPlacement = placement;
    previousError = entry.errorMs;

    const tiedWithNext =
      index < ranked.length - 1 &&
      entry.errorMs !== null &&
      ranked[index + 1]!.errorMs === entry.errorMs;
    const tiedWithPrev =
      index > 0 && entry.errorMs !== null && ranked[index - 1]!.errorMs === entry.errorMs;

    return {
      playerId: entry.playerId,
      errorMs: entry.errorMs,
      placement,
      isTied: tiedWithNext || tiedWithPrev,
      roundPoints: entry.errorMs === null ? 0 : placementPoints(placement),
    };
  });
}

export function applyRoundScores(match: TimingChallengeMatchState): TimingChallengeMatchState {
  const placements = computeRoundPlacements(match);
  const nextScores = { ...match.scores };

  for (const entry of placements) {
    nextScores[entry.playerId] = (nextScores[entry.playerId] ?? 0) + entry.roundPoints;
  }

  return {
    ...match,
    scores: nextScores,
  };
}

export function buildRoundResultEntries(
  match: TimingChallengeMatchState,
): TimingChallengeRoundResultEntry[] {
  const placements = computeRoundPlacements(match);

  return placements.map((entry) => {
    const state = match.round.playerStates[entry.playerId];

    return {
      playerId: entry.playerId,
      name: match.playerNames[entry.playerId] ?? 'لاعب',
      elapsedMs: state?.elapsedMs ?? null,
      guessMs: state?.guessMs ?? null,
      errorMs: entry.errorMs,
      signedDeltaMs: state?.signedDeltaMs ?? null,
      roundPoints: entry.roundPoints,
      totalPoints: match.scores[entry.playerId] ?? 0,
      placement: entry.placement,
      isTied: entry.isTied,
    };
  });
}

export function buildLeaderboardEntries(
  match: TimingChallengeMatchState,
): TimingChallengeLeaderboardEntry[] {
  return [...match.playerIds]
    .sort((leftPlayerId, rightPlayerId) => {
      const scoreDifference =
        (match.scores[rightPlayerId] ?? 0) - (match.scores[leftPlayerId] ?? 0);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return compareArabicNames(
        match.playerNames[leftPlayerId] ?? '',
        match.playerNames[rightPlayerId] ?? '',
      );
    })
    .map((playerId) => ({
      playerId,
      name: match.playerNames[playerId] ?? 'لاعب',
      score: match.scores[playerId] ?? 0,
    }));
}

export function buildResultsLeaderboardEntries(match: TimingChallengeMatchState): Array<{
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
