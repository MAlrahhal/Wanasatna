import { randomUUID } from 'node:crypto';
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
import {
  MATCH_COMPLETED_RETURN_TO_LOBBY_LABEL,
  MATCH_COMPLETED_WAITING_MESSAGE,
  buildRoundResultsContinueCopy,
} from '@wanasatna/shared';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { createOpaqueAnswerId, shuffleIds } from './answers.js';
import {
  JUDGE_RANDOM_CATEGORY_ID,
  pickJudgePrompt,
  pickRoundCategoryId,
  resolveMatchCategorySelection,
} from './prompts.js';
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

export function remainingSecondsFromDeadline(deadlineAtMs: number | null, now = Date.now()): number {
  if (deadlineAtMs === null) {
    return 0;
  }

  return Math.max(0, Math.ceil((deadlineAtMs - now) / 1000));
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

export function isDeparted(match: JudgeMatchState, playerId: string): boolean {
  return match.departedPlayerIds.includes(playerId);
}

export function recountTotalRounds(match: JudgeMatchState): number {
  const future = match.judgeOrder
    .slice(match.judgeOrderIndex + 1)
    .filter((playerId) => !isDeparted(match, playerId)).length;
  return match.currentRound + future;
}

export function createRoundState(
  matchCategoryId: string,
  usedRoundCategoryIds: readonly string[],
  recentPromptIds: readonly string[],
  judgePlayerId: string,
  now = Date.now(),
): { round: JudgeRoundState; usedRoundCategoryIds: string[] } {
  const roundCategoryId = pickRoundCategoryId(matchCategoryId, usedRoundCategoryIds);
  const prompt = pickJudgePrompt(roundCategoryId, recentPromptIds);
  const answeringSeconds = timedPhaseDurations.judgeAnswering();

  const nextUsed =
    matchCategoryId === JUDGE_RANDOM_CATEGORY_ID
      ? usedRoundCategoryIds.includes(roundCategoryId)
        ? [...usedRoundCategoryIds]
        : [...usedRoundCategoryIds, roundCategoryId]
      : [...usedRoundCategoryIds];

  return {
    round: {
      roundId: randomUUID(),
      gamePhase: 'answering',
      phaseRemainingSeconds: answeringSeconds,
      deadlineAtMs: now + answeringSeconds * 1000,
      judgePlayerId,
      promptId: prompt.id,
      prompt: prompt.text,
      categoryId: roundCategoryId,
      answers: [],
      shuffledAnswerIds: [],
      winningAnswerId: null,
    },
    usedRoundCategoryIds: nextUsed,
  };
}

export function createMatchState(
  roomId: string,
  players: GameShellPlayer[],
  _settings: GameContentSettings,
): JudgeMatchState {
  if (players.length === 0) {
    throw new Error('No players available for Judge match.');
  }

  const selection = resolveMatchCategorySelection(roomId);
  const playerIds = players.map((player) => player.id);
  const judgeOrder = createJudgeOrder(playerIds);
  const judgePlayerId = judgeOrder[0]!;
  const { round, usedRoundCategoryIds } = createRoundState(
    selection.matchCategoryId,
    [],
    [],
    judgePlayerId,
  );

  return {
    playerIds,
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    judgeOrder,
    judgeOrderIndex: 0,
    currentRound: 1,
    totalRounds: playerIds.length,
    scores: createInitialScores(playerIds),
    matchStatus: 'in-progress',
    lockedCategoryId: selection.matchCategoryId,
    lockedCategoryLabel: selection.matchCategoryLabel,
    usedRoundCategoryIds,
    departedPlayerIds: [],
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

  return match.playerIds.filter(
    (playerId) => connected.has(playerId) && !isDeparted(match, playerId),
  );
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
    return true;
  }

  return required.every((playerId) => Boolean(findAnswerByPlayerId(match, playerId)));
}

export function submitAnswerToMatch(
  match: JudgeMatchState,
  playerId: string,
  text: string,
): JudgeMatchState {
  if (
    playerId === match.round.judgePlayerId ||
    isDeparted(match, playerId) ||
    findAnswerByPlayerId(match, playerId)
  ) {
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

export function applyJudgingDeadline(
  match: JudgeMatchState,
  now = Date.now(),
): JudgeMatchState {
  const seconds = timedPhaseDurations.judgeJudging();
  return withRound(match, {
    ...match.round,
    gamePhase: 'judging',
    phaseRemainingSeconds: seconds,
    deadlineAtMs: now + seconds * 1000,
    shuffledAnswerIds: shuffleIds(match.round.answers.map((answer) => answer.answerId)),
  });
}

export function beginJudgingPhase(match: JudgeMatchState): JudgeMatchState {
  if (match.round.gamePhase !== 'answering') {
    return match;
  }

  return applyJudgingDeadline(match);
}

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
    match.round.judgePlayerId !== judgePlayerId ||
    isDeparted(match, judgePlayerId)
  ) {
    return { accepted: false, match };
  }

  const answer = findAnswerById(match, answerId);
  const isCurrentAnswer =
    match.round.shuffledAnswerIds.length === 0 ||
    match.round.shuffledAnswerIds.includes(answerId);

  if (!answer || !isCurrentAnswer || answer.ownerPlayerId === judgePlayerId) {
    return { accepted: false, match };
  }

  const nextMatch = withRound(match, {
    ...match.round,
    winningAnswerId: answerId,
  });

  setMatch(nextMatch);
  return { accepted: true, match: nextMatch };
}

export function markPlayerDeparted(
  match: JudgeMatchState,
  playerId: string,
): JudgeMatchState {
  if (isDeparted(match, playerId)) {
    return match;
  }

  const next: JudgeMatchState = {
    ...match,
    departedPlayerIds: [...match.departedPlayerIds, playerId],
  };

  return { ...next, totalRounds: recountTotalRounds(next) };
}

function findNextJudgeIndex(match: JudgeMatchState): number | null {
  for (let index = match.judgeOrderIndex + 1; index < match.judgeOrder.length; index += 1) {
    const playerId = match.judgeOrder[index]!;
    if (!isDeparted(match, playerId)) {
      return index;
    }
  }

  return null;
}

export function resolveNextRoundJudge(
  match: JudgeMatchState,
): { judgePlayerId: string; nextIndex: number } | null {
  const nextIndex = findNextJudgeIndex(match);
  if (nextIndex === null) {
    return null;
  }

  return {
    judgePlayerId: match.judgeOrder[nextIndex]!,
    nextIndex,
  };
}

function buildRevealEntries(match: JudgeMatchState): JudgeRevealEntry[] {
  const order =
    match.round.shuffledAnswerIds.length > 0
      ? match.round.shuffledAnswerIds
      : match.round.answers.map((answer) => answer.answerId);

  return order
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

export function buildJudgePlayerView(
  match: JudgeMatchState,
  playerId: string,
  shell: GameShellState,
): JudgePlayerView {
  const phase = match.round.gamePhase;
  const revealed = phase === 'round-results' || phase === 'match-completed';
  const isParticipant = match.playerIds.includes(playerId) && !isDeparted(match, playerId);
  const isMatchSpectator = !isParticipant;
  const isJudge = isParticipant && playerId === match.round.judgePlayerId;
  const ownAnswer = findAnswerByPlayerId(match, playerId);
  const hasSubmittedAnswer = Boolean(ownAnswer);
  const requiredAnswerers = getRequiredAnswererIds(match, shell);
  const submittedAnswerCount = match.round.answers.length;
  const winningAnswer = match.round.winningAnswerId
    ? findAnswerById(match, match.round.winningAnswerId)
    : undefined;
  const winnerOwnerId = getWinningOwnerId(match);

  const phaseRemainingSeconds = match.round.deadlineAtMs
    ? remainingSecondsFromDeadline(match.round.deadlineAtMs)
    : match.round.phaseRemainingSeconds;

  const base: JudgePlayerView = {
    gamePhase: phase,
    phaseLabel: isMatchSpectator
      ? 'الجولة جارية'
      : `${PHASE_LABELS[phase]} — الجولة ${match.currentRound}/${match.totalRounds}`,
    phaseRemainingSeconds,
    deadlineAtMs: match.round.deadlineAtMs,
    roundId: match.round.roundId,
    prompt: match.round.prompt,
    categoryId: match.lockedCategoryId,
    categoryLabel: match.lockedCategoryLabel,
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
        ? (match.round.shuffledAnswerIds.length > 0
            ? match.round.shuffledAnswerIds
            : match.round.answers.map((answer) => answer.answerId)
          )
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
    leaderboard: isMatchSpectator ? [] : buildLeaderboardEntries(match),
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
