import type {
  GuessingChallengeLeaderboardEntry,
  GuessingChallengeMatchState,
  GuessingChallengeRoundResultEntry,
} from '@wanasatna/shared';
import { GUESSING_CHALLENGE_WINNER_POINTS } from '@wanasatna/shared';

function compareArabicName(left: string, right: string): number {
  return left.localeCompare(right, 'ar');
}

/**
 * Award +100 once to the winning TEAM, then mirror display scores to teammates
 * without double-awarding.
 */
export function applyRoundScores(match: GuessingChallengeMatchState): GuessingChallengeMatchState {
  const winningTeamId = match.round.winningTeamId;
  if (!winningTeamId) {
    return match;
  }

  const teamScores = { ...match.teamScores };
  teamScores[winningTeamId] = (teamScores[winningTeamId] ?? 0) + GUESSING_CHALLENGE_WINNER_POINTS;

  const scores = { ...match.scores };
  for (const playerId of match.playerIds) {
    const teamId = match.teamByPlayerId[playerId];
    if (!teamId) {
      continue;
    }
    scores[playerId] = teamScores[teamId] ?? 0;
  }

  return { ...match, teamScores, scores };
}

export function buildRoundResultEntries(
  match: GuessingChallengeMatchState,
): GuessingChallengeRoundResultEntry[] {
  const winningTeamId = match.round.winningTeamId;

  return [...match.playerIds]
    .map((playerId) => {
      const teamId = match.teamByPlayerId[playerId];
      const isWinner = teamId === winningTeamId;
      return {
        playerId,
        name: match.playerNames[playerId] ?? 'لاعب',
        roundPoints: isWinner ? GUESSING_CHALLENGE_WINNER_POINTS : 0,
        totalPoints: match.scores[playerId] ?? 0,
        isWinner,
      };
    })
    .sort((left, right) => {
      if (right.roundPoints !== left.roundPoints) {
        return right.roundPoints - left.roundPoints;
      }

      return compareArabicName(left.name, right.name);
    });
}

export function buildLeaderboardEntries(
  match: GuessingChallengeMatchState,
): GuessingChallengeLeaderboardEntry[] {
  return [...match.playerIds]
    .map((playerId) => ({
      playerId,
      name: match.playerNames[playerId] ?? 'لاعب',
      score: match.scores[playerId] ?? 0,
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return compareArabicName(left.name, right.name);
    });
}

export function buildResultsLeaderboardEntries(match: GuessingChallengeMatchState) {
  return buildLeaderboardEntries(match).map((entry, index) => ({
    playerId: entry.playerId,
    name: entry.name,
    totalPoints: entry.score,
    rank: index + 1,
    isFirstPlace: index === 0,
  }));
}
