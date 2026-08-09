import type {
  WhoWroteItLeaderboardEntry,
  WhoWroteItMatchState,
  WhoWroteItRoundResultEntry,
} from '@wanasatna/shared';
import { WHO_WROTE_IT_POINTS_PER_CORRECT } from '@wanasatna/shared';

function compareArabicName(left: string, right: string): number {
  return left.localeCompare(right, 'ar');
}

export function countCorrectGuesses(
  match: WhoWroteItMatchState,
  playerId: string,
): number {
  const guesses = match.round.guessesByPlayerId[playerId] ?? {};
  let correct = 0;

  for (const [answerId, guessedOwnerId] of Object.entries(guesses)) {
    const answer = match.round.answers.find((entry) => entry.answerId === answerId);
    if (answer && answer.ownerPlayerId === guessedOwnerId) {
      correct += 1;
    }
  }

  return correct;
}

export function computePlayerRoundPoints(correctCount: number): number {
  return correctCount * WHO_WROTE_IT_POINTS_PER_CORRECT;
}

export function applyRoundScores(match: WhoWroteItMatchState): WhoWroteItMatchState {
  const scores = { ...match.scores };

  for (const playerId of match.playerIds) {
    const correctCount = countCorrectGuesses(match, playerId);
    scores[playerId] = (scores[playerId] ?? 0) + computePlayerRoundPoints(correctCount);
  }

  return { ...match, scores };
}

export function buildRoundResultEntries(
  match: WhoWroteItMatchState,
): WhoWroteItRoundResultEntry[] {
  return [...match.playerIds]
    .map((playerId) => {
      const correctCount = countCorrectGuesses(match, playerId);
      return {
        playerId,
        name: match.playerNames[playerId] ?? 'لاعب',
        correctCount,
        roundPoints: computePlayerRoundPoints(correctCount),
        totalPoints: match.scores[playerId] ?? 0,
      };
    })
    .sort((left, right) => {
      if (right.correctCount !== left.correctCount) {
        return right.correctCount - left.correctCount;
      }

      return compareArabicName(left.name, right.name);
    });
}

export function buildLeaderboardEntries(
  match: WhoWroteItMatchState,
): WhoWroteItLeaderboardEntry[] {
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

export function buildResultsLeaderboardEntries(match: WhoWroteItMatchState) {
  return buildLeaderboardEntries(match).map((entry, index) => ({
    playerId: entry.playerId,
    name: entry.name,
    totalPoints: entry.score,
    rank: index + 1,
    isFirstPlace: index === 0,
  }));
}
