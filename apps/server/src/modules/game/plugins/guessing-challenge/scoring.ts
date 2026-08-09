import type {
  GuessingChallengeLeaderboardEntry,
  GuessingChallengeMatchState,
  GuessingChallengeRoundResultEntry,
} from '@wanasatna/shared';
import { GUESSING_CHALLENGE_WINNER_POINTS } from '@wanasatna/shared';

function compareArabicName(left: string, right: string): number {
  return left.localeCompare(right, 'ar');
}

export function applyRoundScores(match: GuessingChallengeMatchState): GuessingChallengeMatchState {
  const winnerId = match.round.winningPlayerId;
  if (!winnerId) {
    return match;
  }

  const scores = { ...match.scores };
  scores[winnerId] = (scores[winnerId] ?? 0) + GUESSING_CHALLENGE_WINNER_POINTS;
  return { ...match, scores };
}

export function buildRoundResultEntries(
  match: GuessingChallengeMatchState,
): GuessingChallengeRoundResultEntry[] {
  const winnerId = match.round.winningPlayerId;

  return [...match.playerIds]
    .map((playerId) => ({
      playerId,
      name: match.playerNames[playerId] ?? 'لاعب',
      roundPoints: playerId === winnerId ? GUESSING_CHALLENGE_WINNER_POINTS : 0,
      totalPoints: match.scores[playerId] ?? 0,
      isWinner: playerId === winnerId,
    }))
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
