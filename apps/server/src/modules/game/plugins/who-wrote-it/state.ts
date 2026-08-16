import { randomUUID } from 'node:crypto';
import type {
  GameContentSettings,
  GameShellPlayer,
  GameShellState,
  WhoWroteItAnswerRecord,
  WhoWroteItMatchState,
  WhoWroteItPlayerView,
  WhoWroteItRevealEntry,
  WhoWroteItRoundState,
} from '@wanasatna/shared';
import {
  MATCH_COMPLETED_RETURN_TO_LOBBY_LABEL,
  MATCH_COMPLETED_WAITING_MESSAGE,
  WHO_WROTE_IT_DEFAULT_ROUNDS,
  buildRoundResultsContinueCopy,
} from '@wanasatna/shared';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { createOpaqueAnswerId, shuffleIds } from './answers.js';
import {
  pickRoundCategoryId,
  pickWhoWroteItPrompt,
  resolveMatchCategorySelection,
  WHO_WROTE_IT_RANDOM_CATEGORY_ID,
} from './prompts.js';
import {
  buildLeaderboardEntries,
  buildResultsLeaderboardEntries,
  buildRoundResultEntries,
} from './scoring.js';

const PHASE_LABELS = {
  answering: 'أجب على السؤال',
  guessing: 'من كتبها؟',
  'round-results': 'نتائج الجولة',
  'match-completed': 'انتهت المباراة',
} as const;

const MAX_RECENT_QUESTION_IDS = 24;

export function resolveTotalRounds(_settings?: GameContentSettings): number {
  return WHO_WROTE_IT_DEFAULT_ROUNDS;
}

export function withRound(
  match: WhoWroteItMatchState,
  round: WhoWroteItRoundState,
): WhoWroteItMatchState {
  return { ...match, round };
}

export function createInitialScores(playerIds: string[]): Record<string, number> {
  return Object.fromEntries(playerIds.map((playerId) => [playerId, 0]));
}

export function remainingSecondsFromDeadline(deadlineAtMs: number | null, now = Date.now()): number {
  if (deadlineAtMs === null) {
    return 0;
  }

  return Math.max(0, Math.ceil((deadlineAtMs - now) / 1000));
}

export function applyGuessDeadline(
  match: WhoWroteItMatchState,
  now = Date.now(),
): WhoWroteItMatchState {
  const seconds = timedPhaseDurations.whoWroteItGuess();
  return withRound(match, {
    ...match.round,
    phaseRemainingSeconds: seconds,
    deadlineAtMs: now + seconds * 1000,
  });
}

export function createRoundState(
  matchCategoryId: string,
  usedRoundCategoryIds: readonly string[],
  recentQuestionIds: readonly string[],
  now = Date.now(),
): { round: WhoWroteItRoundState; usedRoundCategoryIds: string[] } {
  const roundCategoryId = pickRoundCategoryId(matchCategoryId, usedRoundCategoryIds);
  const prompt = pickWhoWroteItPrompt(roundCategoryId, recentQuestionIds);
  const answeringSeconds = timedPhaseDurations.whoWroteItAnswering();

  const nextUsed =
    matchCategoryId === WHO_WROTE_IT_RANDOM_CATEGORY_ID
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
      questionId: prompt.id,
      question: prompt.text,
      categoryId: roundCategoryId,
      answers: [],
      shuffledAnswerIds: [],
      currentAnswerIndex: 0,
      guessesByPlayerId: {},
    },
    usedRoundCategoryIds: nextUsed,
  };
}

export function createMatchState(
  roomId: string,
  players: GameShellPlayer[],
  settings: GameContentSettings,
): WhoWroteItMatchState {
  if (players.length === 0) {
    throw new Error('No players available for Who Wrote It match.');
  }

  const selection = resolveMatchCategorySelection(roomId);
  const playerIds = players.map((player) => player.id);
  const { round, usedRoundCategoryIds } = createRoundState(
    selection.matchCategoryId,
    [],
    [],
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
  match: WhoWroteItMatchState,
  shell: GameShellState,
): string[] {
  const connected = new Set(
    shell.players.filter((player) => player.isConnected).map((player) => player.id),
  );

  return match.playerIds.filter((playerId) => connected.has(playerId));
}

export function findAnswerByPlayerId(
  match: WhoWroteItMatchState,
  playerId: string,
): WhoWroteItAnswerRecord | undefined {
  return match.round.answers.find((answer) => answer.ownerPlayerId === playerId);
}

export function findAnswerById(
  match: WhoWroteItMatchState,
  answerId: string,
): WhoWroteItAnswerRecord | undefined {
  return match.round.answers.find((answer) => answer.answerId === answerId);
}

export function getPlayerGuessMap(
  match: WhoWroteItMatchState,
  playerId: string,
): Record<string, string> {
  return match.round.guessesByPlayerId[playerId] ?? {};
}

export function getCurrentAnswerId(match: WhoWroteItMatchState): string | null {
  if (match.round.gamePhase !== 'guessing') {
    return null;
  }

  return match.round.shuffledAnswerIds[match.round.currentAnswerIndex] ?? null;
}

export function getCurrentAnswer(
  match: WhoWroteItMatchState,
): WhoWroteItAnswerRecord | undefined {
  const answerId = getCurrentAnswerId(match);
  return answerId ? findAnswerById(match, answerId) : undefined;
}

/** Connected non-owner participants who must guess the current answer. */
export function getRequiredGuesserIds(
  match: WhoWroteItMatchState,
  shell: GameShellState,
): string[] {
  const current = getCurrentAnswer(match);
  if (!current) {
    return [];
  }

  return getConnectedParticipantIds(match, shell).filter(
    (playerId) => playerId !== current.ownerPlayerId,
  );
}

export function countGuessesForCurrentAnswer(
  match: WhoWroteItMatchState,
  shell: GameShellState,
): { guessed: number; required: number } {
  const currentAnswerId = getCurrentAnswerId(match);
  const requiredIds = getRequiredGuesserIds(match, shell);

  if (!currentAnswerId) {
    return { guessed: 0, required: 0 };
  }

  const guessed = requiredIds.filter(
    (playerId) => Boolean(getPlayerGuessMap(match, playerId)[currentAnswerId]),
  ).length;

  return { guessed, required: requiredIds.length };
}

export function allRequiredHaveGuessedCurrent(
  match: WhoWroteItMatchState,
  shell: GameShellState,
): boolean {
  const { guessed, required } = countGuessesForCurrentAnswer(match, shell);
  return guessed >= required;
}

export function getEligibleOwnerOptions(
  match: WhoWroteItMatchState,
  playerId: string,
): Array<{ playerId: string; name: string }> {
  const answerOwners = new Set(match.round.answers.map((answer) => answer.ownerPlayerId));

  return match.playerIds
    .filter((ownerId) => ownerId !== playerId && answerOwners.has(ownerId))
    .map((ownerId) => ({
      playerId: ownerId,
      name: match.playerNames[ownerId] ?? 'لاعب',
    }));
}

export function allConnectedHaveAnswered(
  match: WhoWroteItMatchState,
  shell: GameShellState,
): boolean {
  const connected = getConnectedParticipantIds(match, shell);
  if (connected.length === 0) {
    return false;
  }

  return connected.every((playerId) => Boolean(findAnswerByPlayerId(match, playerId)));
}

export function submitAnswerToMatch(
  match: WhoWroteItMatchState,
  playerId: string,
  text: string,
): WhoWroteItMatchState {
  if (findAnswerByPlayerId(match, playerId)) {
    return match;
  }

  const answer: WhoWroteItAnswerRecord = {
    answerId: createOpaqueAnswerId(),
    ownerPlayerId: playerId,
    text,
  };

  return withRound(match, {
    ...match.round,
    answers: [...match.round.answers, answer],
  });
}

export function beginGuessingPhase(match: WhoWroteItMatchState): WhoWroteItMatchState {
  if (match.round.gamePhase !== 'answering') {
    return match;
  }

  const shuffledAnswerIds = shuffleIds(match.round.answers.map((answer) => answer.answerId));
  const withShuffle = withRound(match, {
    ...match.round,
    gamePhase: 'guessing',
    shuffledAnswerIds,
    currentAnswerIndex: 0,
    guessesByPlayerId: {},
  });

  return applyGuessDeadline(withShuffle);
}

export function applyOwnerGuess(
  match: WhoWroteItMatchState,
  playerId: string,
  answerId: string,
  ownerPlayerId: string,
): WhoWroteItMatchState {
  const existingGuesses = { ...getPlayerGuessMap(match, playerId) };
  existingGuesses[answerId] = ownerPlayerId;

  return withRound(match, {
    ...match.round,
    guessesByPlayerId: {
      ...match.round.guessesByPlayerId,
      [playerId]: existingGuesses,
    },
  });
}

/**
 * Advance global answer index, or signal that guessing is complete.
 * Caller must ensure current answer guesses are complete or timed out.
 */
export function advanceGlobalAnswerOrComplete(
  match: WhoWroteItMatchState,
): { match: WhoWroteItMatchState; completed: boolean } {
  const nextIndex = match.round.currentAnswerIndex + 1;

  if (nextIndex >= match.round.shuffledAnswerIds.length) {
    return { match, completed: true };
  }

  return {
    match: applyGuessDeadline(
      withRound(match, {
        ...match.round,
        currentAnswerIndex: nextIndex,
      }),
    ),
    completed: false,
  };
}

function buildRevealEntries(
  match: WhoWroteItMatchState,
  playerId: string,
): WhoWroteItRevealEntry[] {
  const guesses = getPlayerGuessMap(match, playerId);

  return match.round.shuffledAnswerIds
    .map((answerId) => findAnswerById(match, answerId))
    .filter((answer): answer is WhoWroteItAnswerRecord => Boolean(answer))
    .map((answer) => {
      const isOwn = answer.ownerPlayerId === playerId;
      const guessedOwnerPlayerId = isOwn ? null : (guesses[answer.answerId] ?? null);
      return {
        answerId: answer.answerId,
        text: answer.text,
        ownerPlayerId: answer.ownerPlayerId,
        ownerName: match.playerNames[answer.ownerPlayerId] ?? 'لاعب',
        guessedOwnerPlayerId,
        guessedOwnerName: guessedOwnerPlayerId
          ? (match.playerNames[guessedOwnerPlayerId] ?? 'لاعب')
          : null,
        isCorrect: !isOwn && guessedOwnerPlayerId === answer.ownerPlayerId,
      };
    });
}

export function buildWhoWroteItPlayerView(
  match: WhoWroteItMatchState,
  playerId: string,
  shell: GameShellState,
): WhoWroteItPlayerView {
  const phase = match.round.gamePhase;
  const revealed = phase === 'round-results' || phase === 'match-completed';
  const isParticipant = match.playerIds.includes(playerId);
  const isMatchSpectator = !isParticipant;
  const ownAnswer = findAnswerByPlayerId(match, playerId);
  const hasSubmittedAnswer = Boolean(ownAnswer);
  const connectedIds = getConnectedParticipantIds(match, shell);
  const submittedAnswerCount = match.round.answers.length;
  const totalAnswerSlots = Math.max(connectedIds.length, submittedAnswerCount);

  const currentAnswer = phase === 'guessing' ? getCurrentAnswer(match) : undefined;
  const currentAnswerId = currentAnswer?.answerId ?? null;
  const isOwnAnswer = Boolean(currentAnswer && currentAnswer.ownerPlayerId === playerId);
  const hasGuessedCurrentAnswer = Boolean(
    currentAnswerId && getPlayerGuessMap(match, playerId)[currentAnswerId],
  );
  const guessCounts =
    phase === 'guessing' ? countGuessesForCurrentAnswer(match, shell) : { guessed: 0, required: 0 };

  const phaseRemainingSeconds = match.round.deadlineAtMs
    ? remainingSecondsFromDeadline(match.round.deadlineAtMs)
    : match.round.phaseRemainingSeconds;

  const base: WhoWroteItPlayerView = {
    gamePhase: phase,
    phaseLabel: isMatchSpectator
      ? 'الجولة جارية'
      : `${PHASE_LABELS[phase]} — الجولة ${match.currentRound}/${match.totalRounds}`,
    phaseRemainingSeconds,
    deadlineAtMs: match.round.deadlineAtMs,
    roundId: match.round.roundId,
    question: match.round.question,
    categoryId: match.lockedCategoryId,
    categoryLabel: match.lockedCategoryLabel,
    currentRound: match.currentRound,
    totalRounds: match.totalRounds,
    matchStatus: match.matchStatus,
    canSubmitAnswer: isParticipant && phase === 'answering' && !hasSubmittedAnswer,
    hasSubmittedAnswer,
    submittedAnswerCount,
    totalAnswerSlots,
    currentAnonymousAnswer:
      currentAnswer && phase === 'guessing'
        ? { answerId: currentAnswer.answerId, text: currentAnswer.text }
        : null,
    isOwnAnswer: phase === 'guessing' ? isOwnAnswer : false,
    hasGuessedCurrentAnswer: phase === 'guessing' ? hasGuessedCurrentAnswer : false,
    canSubmitGuess:
      isParticipant &&
      phase === 'guessing' &&
      !isOwnAnswer &&
      !hasGuessedCurrentAnswer &&
      Boolean(currentAnswerId),
    guessingProgressIndex:
      phase === 'guessing'
        ? Math.min(match.round.currentAnswerIndex + 1, match.round.shuffledAnswerIds.length)
        : 0,
    guessingProgressTotal: match.round.shuffledAnswerIds.length,
    currentAnswerGuessCount: guessCounts.guessed,
    currentAnswerRequiredGuessCount: guessCounts.required,
    guessOptions:
      phase === 'guessing' && !isOwnAnswer && !hasGuessedCurrentAnswer && isParticipant
        ? getEligibleOwnerOptions(match, playerId)
        : [],
    revealEntries: revealed ? buildRevealEntries(match, playerId) : [],
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
