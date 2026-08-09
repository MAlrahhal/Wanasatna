import type {
  GameContentSettings,
  GameShellPlayer,
  GameShellState,
  JudgeAnswerRecord,
  JudgeMatchState,
  JudgePlayerView,
  JudgeRevealEntry,
  JudgeRoundState,
} from '@wanasatna/shared';
import { JUDGE_DEFAULT_ROUNDS } from '@wanasatna/shared';
import { resolveMatchRounds } from '../../../../config/test-timers.js';
import { getRoomRoundCategory } from '../../runtime/round-category-store.js';
import { createOpaqueAnswerId, shuffleIds } from './answers.js';
import { pickJudgePrompt } from './prompts.js';
import {
  buildLeaderboardEntries,
  buildResultsLeaderboardEntries,
  buildRoundResultEntries,
  getWinningOwnerId,
} from './scoring.js';

const PHASE_LABELS = {
  answering: 'أجب على السؤال',
  judging: 'القاضي يختار',
  'round-results': 'نتائج الجولة',
  'match-completed': 'انتهت المباراة',
} as const;

const MAX_RECENT_PROMPT_IDS = 24;

export function resolveTotalRounds(settings: GameContentSettings): number {
  return resolveMatchRounds(settings.rounds, JUDGE_DEFAULT_ROUNDS);
}

export function withRound(match: JudgeMatchState, round: JudgeRoundState): JudgeMatchState {
  return { ...match, round };
}

export function createInitialScores(playerIds: string[]): Record<string, number> {
  return Object.fromEntries(playerIds.map((playerId) => [playerId, 0]));
}

export function createJudgeOrder(playerIds: readonly string[]): string[] {
  return shuffleIds(playerIds);
}

export function resolveJudgeForRound(
  judgeOrder: readonly string[],
  judgeOrderIndex: number,
): { judgePlayerId: string; nextIndex: number; nextOrder: string[] } {
  if (judgeOrder.length === 0) {
    throw new Error('Judge order is empty.');
  }

  if (judgeOrderIndex < judgeOrder.length) {
    return {
      judgePlayerId: judgeOrder[judgeOrderIndex]!,
      nextIndex: judgeOrderIndex + 1,
      nextOrder: [...judgeOrder],
    };
  }

  const reshuffled = shuffleIds(judgeOrder);
  // Avoid consecutive repeat of last judge when possible
  if (reshuffled.length > 1 && reshuffled[0] === judgeOrder[judgeOrder.length - 1]) {
    const swapWith = reshuffled[reshuffled.length - 1]!;
    reshuffled[reshuffled.length - 1] = reshuffled[0]!;
    reshuffled[0] = swapWith;
  }

  return {
    judgePlayerId: reshuffled[0]!,
    nextIndex: 1,
    nextOrder: reshuffled,
  };
}

export function createRoundState(
  roomId: string,
  judgePlayerId: string,
  recentPromptIds: readonly string[],
): JudgeRoundState {
  const prompt = pickJudgePrompt(roomId, recentPromptIds);

  return {
    gamePhase: 'answering',
    phaseRemainingSeconds: 0,
    judgePlayerId,
    promptId: prompt.id,
    prompt: prompt.text,
    categoryId: prompt.categoryId,
    answers: [],
    shuffledAnswerIds: [],
    winningAnswerId: null,
  };
}

export function createMatchState(
  roomId: string,
  players: GameShellPlayer[],
  settings: GameContentSettings,
): JudgeMatchState {
  if (players.length === 0) {
    throw new Error('No players available for Judge match.');
  }

  const playerIds = players.map((player) => player.id);
  const judgeOrder = createJudgeOrder(playerIds);
  const resolved = resolveJudgeForRound(judgeOrder, 0);
  const round = createRoundState(roomId, resolved.judgePlayerId, []);

  return {
    playerIds,
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    judgeOrder: resolved.nextOrder,
    judgeOrderIndex: resolved.nextIndex,
    currentRound: 1,
    totalRounds: resolveTotalRounds(settings),
    scores: createInitialScores(playerIds),
    matchStatus: 'in-progress',
    recentPromptIds: [round.promptId],
    round,
  };
}

export function appendRecentPromptId(
  recentPromptIds: readonly string[],
  promptId: string,
): string[] {
  const next = [...recentPromptIds.filter((id) => id !== promptId), promptId];
  return next.slice(-MAX_RECENT_PROMPT_IDS);
}

export function getConnectedParticipantIds(
  match: JudgeMatchState,
  shell: GameShellState,
): string[] {
  const connected = new Set(
    shell.players.filter((player) => player.isConnected).map((player) => player.id),
  );

  return match.playerIds.filter((playerId) => connected.has(playerId));
}

export function findAnswerByPlayerId(
  match: JudgeMatchState,
  playerId: string,
): JudgeAnswerRecord | undefined {
  return match.round.answers.find((answer) => answer.ownerPlayerId === playerId);
}

export function findAnswerById(
  match: JudgeMatchState,
  answerId: string,
): JudgeAnswerRecord | undefined {
  return match.round.answers.find((answer) => answer.answerId === answerId);
}

export function getRequiredAnswererIds(
  match: JudgeMatchState,
  shell: GameShellState,
): string[] {
  return getConnectedParticipantIds(match, shell).filter(
    (playerId) => playerId !== match.round.judgePlayerId,
  );
}

export function allRequiredHaveAnswered(
  match: JudgeMatchState,
  shell: GameShellState,
): boolean {
  const required = getRequiredAnswererIds(match, shell);
  if (required.length === 0) {
    return false;
  }

  return required.every((playerId) => Boolean(findAnswerByPlayerId(match, playerId)));
}

export function submitAnswerToMatch(
  match: JudgeMatchState,
  playerId: string,
  text: string,
): JudgeMatchState {
  if (playerId === match.round.judgePlayerId || findAnswerByPlayerId(match, playerId)) {
    return match;
  }

  const answer: JudgeAnswerRecord = {
    answerId: createOpaqueAnswerId(),
    ownerPlayerId: playerId,
    text,
  };

  return withRound(match, {
    ...match.round,
    answers: [...match.round.answers, answer],
  });
}

export function beginJudgingPhase(match: JudgeMatchState): JudgeMatchState {
  if (match.round.gamePhase !== 'answering') {
    return match;
  }

  return withRound(match, {
    ...match.round,
    gamePhase: 'judging',
    shuffledAnswerIds: shuffleIds(match.round.answers.map((answer) => answer.answerId)),
  });
}

/**
 * Atomically claim the winning answer. Must not await before claim.
 */
export function trySelectWinner(
  getMatch: () => JudgeMatchState | null,
  setMatch: (match: JudgeMatchState) => void,
  judgePlayerId: string,
  answerId: string,
): { accepted: boolean; match: JudgeMatchState | null } {
  const match = getMatch();

  if (
    !match ||
    match.round.gamePhase !== 'judging' ||
    match.round.winningAnswerId !== null ||
    match.round.judgePlayerId !== judgePlayerId
  ) {
    return { accepted: false, match };
  }

  const answer = findAnswerById(match, answerId);
  if (!answer || answer.ownerPlayerId === judgePlayerId) {
    return { accepted: false, match };
  }

  const nextMatch = withRound(match, {
    ...match.round,
    winningAnswerId: answerId,
  });

  setMatch(nextMatch);
  return { accepted: true, match: nextMatch };
}

function buildRevealEntries(match: JudgeMatchState): JudgeRevealEntry[] {
  return match.round.shuffledAnswerIds
    .map((answerId) => findAnswerById(match, answerId))
    .filter((answer): answer is JudgeAnswerRecord => Boolean(answer))
    .map((answer) => ({
      answerId: answer.answerId,
      text: answer.text,
      ownerPlayerId: answer.ownerPlayerId,
      ownerName: match.playerNames[answer.ownerPlayerId] ?? 'لاعب',
      isWinner: answer.answerId === match.round.winningAnswerId,
    }));
}

function buildRoundResultsInteractionView(
  match: JudgeMatchState,
  shell: GameShellState,
  playerId: string,
): Pick<
  JudgePlayerView,
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
    roundResultsWaitingMessage: isHost ? null : 'بانتظار المضيف...',
  };
}

export function buildJudgePlayerView(
  match: JudgeMatchState,
  playerId: string,
  shell: GameShellState,
): JudgePlayerView {
  const phase = match.round.gamePhase;
  const revealed = phase === 'round-results' || phase === 'match-completed';
  const isParticipant = match.playerIds.includes(playerId);
  const isJudge = playerId === match.round.judgePlayerId;
  const ownAnswer = findAnswerByPlayerId(match, playerId);
  const hasSubmittedAnswer = Boolean(ownAnswer);
  const requiredAnswerers = getRequiredAnswererIds(match, shell);
  const submittedAnswerCount = match.round.answers.length;
  const winningAnswer = match.round.winningAnswerId
    ? findAnswerById(match, match.round.winningAnswerId)
    : undefined;
  const winnerOwnerId = getWinningOwnerId(match);

  return {
    gamePhase: phase,
    phaseLabel: `${PHASE_LABELS[phase]} — الجولة ${match.currentRound}/${match.totalRounds}`,
    phaseRemainingSeconds: match.round.phaseRemainingSeconds,
    prompt: match.round.prompt,
    categoryId: match.round.categoryId,
    nextCategoryId: getRoomRoundCategory(shell.roomId) ?? 'random',
    currentRound: match.currentRound,
    totalRounds: match.totalRounds,
    matchStatus: match.matchStatus,
    judgePlayerId: match.round.judgePlayerId,
    judgeName: match.playerNames[match.round.judgePlayerId] ?? 'لاعب',
    isJudge,
    canSubmitAnswer:
      isParticipant && phase === 'answering' && !isJudge && !hasSubmittedAnswer,
    hasSubmittedAnswer,
    submittedAnswerCount,
    totalAnswerSlots: Math.max(requiredAnswerers.length, submittedAnswerCount),
    anonymousAnswers:
      phase === 'judging' || revealed
        ? match.round.shuffledAnswerIds
            .map((answerId) => findAnswerById(match, answerId))
            .filter((answer): answer is JudgeAnswerRecord => Boolean(answer))
            .map((answer) => ({ answerId: answer.answerId, text: answer.text }))
        : [],
    canSelectWinner:
      isParticipant &&
      isJudge &&
      phase === 'judging' &&
      match.round.winningAnswerId === null,
    selectedWinningAnswerId: revealed ? match.round.winningAnswerId : null,
    revealEntries: revealed ? buildRevealEntries(match) : [],
    winningAnswerText: revealed ? (winningAnswer?.text ?? null) : null,
    winnerName:
      revealed && winnerOwnerId ? (match.playerNames[winnerOwnerId] ?? 'لاعب') : null,
    roundResults: revealed ? buildRoundResultEntries(match) : [],
    leaderboard: buildLeaderboardEntries(match),
    resultsLeaderboard: buildResultsLeaderboardEntries(match),
    ...buildRoundResultsInteractionView(match, shell, playerId),
  };
}
