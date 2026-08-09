import type {
  FastAnswerMatchState,
  FastAnswerPlayerView,
  FastAnswerRoundState,
  GameContentSettings,
  GameShellPlayer,
  GameShellState,
} from '@wanasatna/shared';
import {
  FAST_ANSWER_DEFAULT_ROUND_SECONDS,
  FAST_ANSWER_DEFAULT_ROUNDS,
} from '@wanasatna/shared';
import {
  resolveDescriptionDurationSeconds,
  resolveMatchRounds,
} from '../../../../config/test-timers.js';
import { getRoomRoundCategory } from '../../runtime/round-category-store.js';
import { revealPrimaryAnswer } from './answers.js';
import { pickFastAnswerQuestion } from './questions.js';
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

export function resolveTotalRounds(settings: GameContentSettings): number {
  return resolveMatchRounds(settings.rounds, FAST_ANSWER_DEFAULT_ROUNDS);
}

export function resolveRoundTimeSeconds(settings: GameContentSettings): number {
  return resolveDescriptionDurationSeconds(
    settings.roundTime ?? FAST_ANSWER_DEFAULT_ROUND_SECONDS,
  );
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
  roomId: string,
  recentQuestionIds: readonly string[],
  roundTimeSeconds: number,
  now = Date.now(),
): FastAnswerRoundState {
  const question = pickFastAnswerQuestion(roomId, recentQuestionIds);
  const deadlineAtMs = now + roundTimeSeconds * 1000;

  return {
    gamePhase: 'question',
    phaseRemainingSeconds: roundTimeSeconds,
    questionId: question.id,
    question: question.question,
    categoryId: question.categoryId,
    acceptedAnswers: question.acceptedAnswers,
    deadlineAtMs,
    winnerPlayerId: null,
    timedOut: false,
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

  const playerIds = players.map((player) => player.id);
  const roundTimeSeconds = resolveRoundTimeSeconds(settings);
  const round = createRoundState(roomId, [], roundTimeSeconds);

  return {
    playerIds,
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    currentRound: 1,
    totalRounds: resolveTotalRounds(settings),
    scores: createInitialScores(playerIds),
    matchStatus: 'in-progress',
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

function buildRoundResultsInteractionView(
  match: FastAnswerMatchState,
  shell: GameShellState,
  playerId: string,
): Pick<
  FastAnswerPlayerView,
  | 'isHost'
  | 'canContinueFromRoundResults'
  | 'roundResultsContinueLabel'
  | 'roundResultsWaitingMessage'
> {
  const isHost = shell.hostPlayerId === playerId;
  const isFinalRound = match.currentRound >= match.totalRounds;

  return {
    isHost,
    canContinueFromRoundResults: isHost && match.round.gamePhase === 'round-results',
    roundResultsContinueLabel: isHost
      ? isFinalRound
        ? 'عرض النتائج النهائية'
        : 'بدء الجولة التالية'
      : null,
    roundResultsWaitingMessage: isHost ? null : 'بانتظار المضيف للمتابعة...',
  };
}

export function buildFastAnswerPlayerView(
  match: FastAnswerMatchState,
  playerId: string,
  shell: GameShellState,
): FastAnswerPlayerView {
  const phase = match.round.gamePhase;
  const revealed = phase === 'round-results' || phase === 'match-completed';
  const isParticipant = match.playerIds.includes(playerId);
  const phaseRemainingSeconds =
    phase === 'question'
      ? remainingSecondsFromDeadline(match.round.deadlineAtMs)
      : match.round.phaseRemainingSeconds;

  return {
    gamePhase: phase,
    phaseLabel: `${PHASE_LABELS[phase]} — الجولة ${match.currentRound}/${match.totalRounds}`,
    phaseRemainingSeconds,
    questionDeadlineAtMs: phase === 'question' ? match.round.deadlineAtMs : null,
    question: match.round.question,
    categoryId: match.round.categoryId,
    nextCategoryId: getRoomRoundCategory(shell.roomId) ?? 'random',
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
    ...buildRoundResultsInteractionView(match, shell, playerId),
  };
}

/**
 * Synchronously claim the round for the first correct answerer.
 * Must not await anything before reading/writing state.
 */
export function tryAcceptCorrectAnswer(
  getMatch: () => FastAnswerMatchState | null,
  setMatch: (match: FastAnswerMatchState) => void,
  playerId: string,
): { accepted: boolean; match: FastAnswerMatchState | null } {
  const match = getMatch();

  if (!match || match.round.gamePhase !== 'question' || match.round.winnerPlayerId !== null) {
    return { accepted: false, match };
  }

  const nextMatch = withRound(match, {
    ...match.round,
    winnerPlayerId: playerId,
    timedOut: false,
  });

  setMatch(nextMatch);
  return { accepted: true, match: nextMatch };
}
