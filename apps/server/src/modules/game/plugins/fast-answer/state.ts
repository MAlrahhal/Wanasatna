import { randomUUID } from 'node:crypto';
import type {
  FastAnswerMatchState,
  FastAnswerPlayerView,
  FastAnswerRoundState,
  GameContentSettings,
  GameShellPlayer,
  GameShellState,
} from '@wanasatna/shared';
import {
  FAST_ANSWER_DEFAULT_ROUNDS,
  MATCH_COMPLETED_RETURN_TO_LOBBY_LABEL,
  MATCH_COMPLETED_WAITING_MESSAGE,
  buildRoundResultsContinueCopy,
} from '@wanasatna/shared';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { revealPrimaryAnswer } from './answers.js';
import {
  FAST_ANSWER_RANDOM_CATEGORY_ID,
  pickFastAnswerQuestion,
  pickRoundCategoryId,
  resolveMatchCategorySelection,
} from './questions.js';
import {
  buildLeaderboardEntries,
  buildResultsLeaderboardEntries,
  buildRoundResultEntries,
} from './scoring.js';

const PHASE_LABELS = {
  question: 'أسرع إجابة',
  'round-results': 'نتيجة الجولة',
  'match-completed': 'انتهت المباراة',
} as const;

const MAX_RECENT_QUESTION_IDS = 24;

export function resolveTotalRounds(_settings?: GameContentSettings): number {
  return FAST_ANSWER_DEFAULT_ROUNDS;
}

export function resolveRoundTimeSeconds(_settings?: GameContentSettings): number {
  return timedPhaseDurations.fastAnswerQuestion();
}

export function createInitialScores(playerIds: string[]): Record<string, number> {
  return Object.fromEntries(playerIds.map((playerId) => [playerId, 0]));
}

export function withRound(
  match: FastAnswerMatchState,
  round: FastAnswerRoundState,
): FastAnswerMatchState {
  return { ...match, round };
}

export function remainingSecondsFromDeadline(deadlineAtMs: number | null, now = Date.now()): number {
  if (deadlineAtMs === null) {
    return 0;
  }

  return Math.max(0, Math.ceil((deadlineAtMs - now) / 1000));
}

export function createRoundState(
  matchCategoryId: string,
  usedRoundCategoryIds: readonly string[],
  recentQuestionIds: readonly string[],
  roundTimeSeconds: number,
  now = Date.now(),
): { round: FastAnswerRoundState; usedRoundCategoryIds: string[] } {
  const roundCategoryId = pickRoundCategoryId(matchCategoryId, usedRoundCategoryIds);
  const question = pickFastAnswerQuestion(roundCategoryId, recentQuestionIds);
  const deadlineAtMs = now + roundTimeSeconds * 1000;

  const nextUsed =
    matchCategoryId === FAST_ANSWER_RANDOM_CATEGORY_ID
      ? usedRoundCategoryIds.includes(roundCategoryId)
        ? [...usedRoundCategoryIds]
        : [...usedRoundCategoryIds, roundCategoryId]
      : [...usedRoundCategoryIds];

  return {
    round: {
      roundId: randomUUID(),
      gamePhase: 'question',
      phaseRemainingSeconds: roundTimeSeconds,
      questionId: question.id,
      question: question.question,
      categoryId: roundCategoryId,
      acceptedAnswers: question.acceptedAnswers,
      deadlineAtMs,
      winnerPlayerId: null,
      timedOut: false,
    },
    usedRoundCategoryIds: nextUsed,
  };
}

export function createMatchState(
  roomId: string,
  players: GameShellPlayer[],
  settings: GameContentSettings,
): FastAnswerMatchState {
  if (players.length === 0) {
    throw new Error('No players available for Fast Answer match.');
  }

  const selection = resolveMatchCategorySelection(roomId);
  const playerIds = players.map((player) => player.id);
  const roundTimeSeconds = resolveRoundTimeSeconds(settings);
  const { round, usedRoundCategoryIds } = createRoundState(
    selection.matchCategoryId,
    [],
    [],
    roundTimeSeconds,
  );

  return {
    playerIds,
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    currentRound: 1,
    totalRounds: resolveTotalRounds(settings),
    scores: createInitialScores(playerIds),
    matchStatus: 'in-progress',
    lockedCategoryId: selection.matchCategoryId,
    lockedCategoryLabel: selection.matchCategoryLabel,
    usedRoundCategoryIds,
    roundTimeSeconds,
    recentQuestionIds: [round.questionId],
    round,
  };
}

export function appendRecentQuestionId(
  recentQuestionIds: readonly string[],
  questionId: string,
): string[] {
  const next = [...recentQuestionIds.filter((id) => id !== questionId), questionId];
  return next.slice(-MAX_RECENT_QUESTION_IDS);
}

export function getConnectedParticipantIds(
  match: FastAnswerMatchState,
  shell: GameShellState,
): string[] {
  const connected = new Set(
    shell.players.filter((player) => player.isConnected).map((player) => player.id),
  );

  return match.playerIds.filter((playerId) => connected.has(playerId));
}

export function buildFastAnswerPlayerView(
  match: FastAnswerMatchState,
  playerId: string,
  shell: GameShellState,
): FastAnswerPlayerView {
  const phase = match.round.gamePhase;
  const revealed = phase === 'round-results' || phase === 'match-completed';
  const isParticipant = match.playerIds.includes(playerId);
  const isMatchSpectator = !isParticipant;
  const phaseRemainingSeconds =
    phase === 'question'
      ? remainingSecondsFromDeadline(match.round.deadlineAtMs)
      : match.round.phaseRemainingSeconds;

  const base: FastAnswerPlayerView = {
    gamePhase: phase,
    phaseLabel: isMatchSpectator
      ? 'الجولة جارية'
      : `${PHASE_LABELS[phase]} — الجولة ${match.currentRound}/${match.totalRounds}`,
    phaseRemainingSeconds,
    questionDeadlineAtMs: phase === 'question' ? match.round.deadlineAtMs : null,
    roundId: match.round.roundId,
    question: match.round.question,
    categoryId: match.lockedCategoryId,
    categoryLabel: match.lockedCategoryLabel,
    currentRound: match.currentRound,
    totalRounds: match.totalRounds,
    matchStatus: match.matchStatus,
    canSubmitAnswer:
      isParticipant && phase === 'question' && match.round.winnerPlayerId === null,
    revealedAnswer: revealed ? revealPrimaryAnswer(match.round.acceptedAnswers) : null,
    winnerPlayerId: revealed ? match.round.winnerPlayerId : null,
    winnerName:
      revealed && match.round.winnerPlayerId
        ? (match.playerNames[match.round.winnerPlayerId] ?? 'لاعب')
        : null,
    timedOut: revealed ? match.round.timedOut : false,
    roundResults: revealed ? buildRoundResultEntries(match) : [],
    leaderboard: buildLeaderboardEntries(match),
    resultsLeaderboard: buildResultsLeaderboardEntries(match),
    isHost: shell.hostPlayerId === playerId,
    canContinueFromRoundResults: false,
    roundResultsContinueLabel: null,
    roundResultsWaitingMessage: null,
    isMatchSpectator,
  };

  if (phase === 'round-results') {
    return {
      ...base,
      ...buildRoundResultsContinueCopy({
        isFinalRound: match.currentRound >= match.totalRounds,
        isHost: shell.hostPlayerId === playerId,
      }),
    };
  }

  if (phase === 'match-completed') {
    const isHost = shell.hostPlayerId === playerId;
    return {
      ...base,
      isHost,
      canContinueFromRoundResults: isHost,
      roundResultsContinueLabel: isHost ? MATCH_COMPLETED_RETURN_TO_LOBBY_LABEL : null,
      roundResultsWaitingMessage: MATCH_COMPLETED_WAITING_MESSAGE,
    };
  }

  return base;
}

/**
 * Synchronously claim the round for the first correct answerer.
 * Must not await anything before reading/writing state.
 */
export function tryAcceptCorrectAnswer(
  getMatch: () => FastAnswerMatchState | null,
  setMatch: (match: FastAnswerMatchState) => void,
  playerId: string,
  roundId: string,
): { accepted: boolean; match: FastAnswerMatchState | null; reason?: 'stale' | 'closed' } {
  const match = getMatch();

  if (!match || match.round.gamePhase !== 'question') {
    return { accepted: false, match, reason: 'closed' };
  }

  if (match.round.roundId !== roundId) {
    return { accepted: false, match, reason: 'stale' };
  }

  if (match.round.winnerPlayerId !== null) {
    return { accepted: false, match, reason: 'closed' };
  }

  const nextMatch = withRound(match, {
    ...match.round,
    winnerPlayerId: playerId,
    timedOut: false,
  });

  setMatch(nextMatch);
  return { accepted: true, match: nextMatch };
}
