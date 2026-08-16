import {
  BARA_AL_SALAFA_GAME_ID,
  DRAW_GUESS_GAME_ID,
  FAST_ANSWER_GAME_ID,
  GUESSING_CHALLENGE_GAME_ID,
  IMPOSTER_DRAW_GAME_ID,
  JUDGE_GAME_ID,
  TIMING_CHALLENGE_GAME_ID,
  WHO_WROTE_IT_GAME_ID,
} from '@wanasatna/shared';
import type { MatchParticipantResult } from '../../match/match-history.types.js';
import { buildResultsLeaderboardEntries as buildBaraResults } from '../plugins/bara-al-salafa/scoring.js';
import { getBaraAlSalafaState } from '../plugins/bara-al-salafa/store.js';
import { buildResultsLeaderboardEntries as buildDrawGuessResults } from '../plugins/draw-guess/scoring.js';
import { getDrawGuessState } from '../plugins/draw-guess/store.js';
import { buildResultsLeaderboardEntries as buildFastAnswerResults } from '../plugins/fast-answer/scoring.js';
import { getFastAnswerState } from '../plugins/fast-answer/store.js';
import { buildResultsLeaderboardEntries as buildGuessingChallengeResults } from '../plugins/guessing-challenge/scoring.js';
import { getGuessingChallengeState } from '../plugins/guessing-challenge/store.js';
import { buildResultsLeaderboardEntries as buildImposterDrawResults } from '../plugins/imposter-draw/scoring.js';
import { getImposterDrawState } from '../plugins/imposter-draw/store.js';
import { buildResultsLeaderboardEntries as buildJudgeResults } from '../plugins/judge/scoring.js';
import { getJudgeState } from '../plugins/judge/store.js';
import { buildResultsLeaderboardEntries as buildTimingChallengeResults } from '../plugins/timing-challenge/scoring.js';
import { getTimingChallengeState } from '../plugins/timing-challenge/store.js';
import { buildResultsLeaderboardEntries as buildWhoWroteItResults } from '../plugins/who-wrote-it/scoring.js';
import { getWhoWroteItState } from '../plugins/who-wrote-it/store.js';

type ResultsLeaderboardEntry = {
  playerId: string;
  totalPoints: number;
  rank: number;
  isFirstPlace: boolean;
};

function mapLeaderboard(
  entries: ResultsLeaderboardEntry[],
  teamByPlayerId?: Record<string, string>,
): MatchParticipantResult[] {
  return entries.map((entry) => ({
    playerId: entry.playerId,
    score: entry.totalPoints,
    rank: entry.rank,
    team: teamByPlayerId?.[entry.playerId] ?? null,
    isWinner: entry.isFirstPlace,
  }));
}

export function collectMatchHistoryResults(
  roomId: string,
  gameId: string | null,
): MatchParticipantResult[] {
  if (gameId === BARA_AL_SALAFA_GAME_ID) {
    const match = getBaraAlSalafaState(roomId);
    return match ? mapLeaderboard(buildBaraResults(match)) : [];
  }

  if (gameId === DRAW_GUESS_GAME_ID) {
    const match = getDrawGuessState(roomId);
    return match ? mapLeaderboard(buildDrawGuessResults(match)) : [];
  }

  if (gameId === FAST_ANSWER_GAME_ID) {
    const match = getFastAnswerState(roomId);
    return match ? mapLeaderboard(buildFastAnswerResults(match)) : [];
  }

  if (gameId === IMPOSTER_DRAW_GAME_ID) {
    const match = getImposterDrawState(roomId);
    return match ? mapLeaderboard(buildImposterDrawResults(match)) : [];
  }

  if (gameId === TIMING_CHALLENGE_GAME_ID) {
    const match = getTimingChallengeState(roomId);
    return match ? mapLeaderboard(buildTimingChallengeResults(match)) : [];
  }

  if (gameId === WHO_WROTE_IT_GAME_ID) {
    const match = getWhoWroteItState(roomId);
    return match ? mapLeaderboard(buildWhoWroteItResults(match)) : [];
  }

  if (gameId === JUDGE_GAME_ID) {
    const match = getJudgeState(roomId);
    return match ? mapLeaderboard(buildJudgeResults(match)) : [];
  }

  if (gameId === GUESSING_CHALLENGE_GAME_ID) {
    const match = getGuessingChallengeState(roomId);
    return match
      ? mapLeaderboard(buildGuessingChallengeResults(match), match.teamByPlayerId)
      : [];
  }

  return [];
}
