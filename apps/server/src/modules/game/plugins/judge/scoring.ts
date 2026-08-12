import type {
  JudgeLeaderboardEntry,
  JudgeMatchState,
  JudgeRoundResultEntry,
} from '@wanasatna/shared';
import { JUDGE_WINNER_POINTS } from '@wanasatna/shared';

function compareArabicName(left: string, right: string): number {
  return left.localeCompare(right, 'ar');
}

export function getWinningOwnerId(match: JudgeMatchState): string | null {
  const winningAnswerId = match.round.winningAnswerId;
  if (!winningAnswerId) {
    return null;
  }

  return (
    match.round.answers.find((answer) => answer.answerId === winningAnswerId)?.ownerPlayerId ??
    null
  );
}

export function applyRoundScores(match: JudgeMatchState): JudgeMatchState {
  if (match.round.gamePhase !== 'answering' && match.round.gamePhase !== 'judging') {
    return match;
  }

  const winnerId = getWinningOwnerId(match);
  if (!winnerId) {
    return match;
  }

  const scores = { ...match.scores };
  scores[winnerId] = (scores[winnerId] ?? 0) + JUDGE_WINNER_POINTS;
  return { ...match, scores };
}

export function buildRoundResultEntries(match: JudgeMatchState): JudgeRoundResultEntry[] {
  const winnerId = getWinningOwnerId(match);

  return [...match.playerIds]
    .map((playerId) => ({
      playerId,
      name: match.playerNames[playerId] ?? 'لاعب',
      roundPoints: playerId === winnerId ? JUDGE_WINNER_POINTS : 0,
      totalPoints: match.scores[playerId] ?? 0,
      isWinner: playerId === winnerId,
      isJudge: playerId === match.round.judgePlayerId,
    }))
    .sort((left, right) => {
      if (right.roundPoints !== left.roundPoints) {
        return right.roundPoints - left.roundPoints;
      }

      return compareArabicName(left.name, right.name);
    });
}

export function buildLeaderboardEntries(match: JudgeMatchState): JudgeLeaderboardEntry[] {
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

export function buildResultsLeaderboardEntries(match: JudgeMatchState) {
  return buildLeaderboardEntries(match).map((entry, index) => ({
    playerId: entry.playerId,
    name: entry.name,
    totalPoints: entry.score,
    rank: index + 1,
    isFirstPlace: index === 0,
  }));
}
