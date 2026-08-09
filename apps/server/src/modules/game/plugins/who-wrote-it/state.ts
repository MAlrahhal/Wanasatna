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
import { WHO_WROTE_IT_DEFAULT_ROUNDS } from '@wanasatna/shared';
import { resolveMatchRounds } from '../../../../config/test-timers.js';
import { getRoomRoundCategory } from '../../runtime/round-category-store.js';
import { createOpaqueAnswerId, shuffleIds } from './answers.js';
import { pickWhoWroteItPrompt } from './prompts.js';
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

export function resolveTotalRounds(settings: GameContentSettings): number {
  return resolveMatchRounds(settings.rounds, WHO_WROTE_IT_DEFAULT_ROUNDS);
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

export function createRoundState(
  roomId: string,
  recentQuestionIds: readonly string[],
): WhoWroteItRoundState {
  const prompt = pickWhoWroteItPrompt(roomId, recentQuestionIds);

  return {
    gamePhase: 'answering',
    phaseRemainingSeconds: 0,
    questionId: prompt.id,
    question: prompt.text,
    categoryId: prompt.categoryId,
    answers: [],
    shuffledAnswerIds: [],
    currentAnswerIndex: 0,
    guessesByPlayerId: {},
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

  const playerIds = players.map((player) => player.id);
  const round = createRoundState(roomId, []);

  return {
    playerIds,
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    currentRound: 1,
    totalRounds: resolveTotalRounds(settings),
    scores: createInitialScores(playerIds),
    matchStatus: 'in-progress',
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
  return required > 0 && guessed >= required;
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

  return withRound(match, {
    ...match.round,
    gamePhase: 'guessing',
    shuffledAnswerIds,
    currentAnswerIndex: 0,
    guessesByPlayerId: {},
  });
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
 * Caller must ensure current answer guesses are complete.
 */
export function advanceGlobalAnswerOrComplete(
  match: WhoWroteItMatchState,
): { match: WhoWroteItMatchState; completed: boolean } {
  const nextIndex = match.round.currentAnswerIndex + 1;

  if (nextIndex >= match.round.shuffledAnswerIds.length) {
    return { match, completed: true };
  }

  return {
    match: withRound(match, {
      ...match.round,
      currentAnswerIndex: nextIndex,
    }),
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

function buildRoundResultsInteractionView(
  match: WhoWroteItMatchState,
  shell: GameShellState,
  playerId: string,
): Pick<
  WhoWroteItPlayerView,
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

export function buildWhoWroteItPlayerView(
  match: WhoWroteItMatchState,
  playerId: string,
  shell: GameShellState,
): WhoWroteItPlayerView {
  const phase = match.round.gamePhase;
  const revealed = phase === 'round-results' || phase === 'match-completed';
  const isParticipant = match.playerIds.includes(playerId);
  const ownAnswer = findAnswerByPlayerId(match, playerId);
  const hasSubmittedAnswer = Boolean(ownAnswer);
  const connectedIds = getConnectedParticipantIds(match, shell);
  const submittedAnswerCount = match.round.answers.length;
  const totalAnswerSlots = Math.max(connectedIds.length, submittedAnswerCount);

  const currentAnswer = phase === 'guessing' ? getCurrentAnswer(match) : undefined;
  const currentAnswerId = currentAnswer?.answerId ?? null;
  const isOwnAnswer = Boolean(
    currentAnswer && currentAnswer.ownerPlayerId === playerId,
  );
  const hasGuessedCurrentAnswer = Boolean(
    currentAnswerId && getPlayerGuessMap(match, playerId)[currentAnswerId],
  );
  const guessCounts = phase === 'guessing'
    ? countGuessesForCurrentAnswer(match, shell)
    : { guessed: 0, required: 0 };

  return {
    gamePhase: phase,
    phaseLabel: `${PHASE_LABELS[phase]} — الجولة ${match.currentRound}/${match.totalRounds}`,
    phaseRemainingSeconds: match.round.phaseRemainingSeconds,
    question: match.round.question,
    categoryId: match.round.categoryId,
    nextCategoryId: getRoomRoundCategory(shell.roomId) ?? 'random',
    currentRound: match.currentRound,
    totalRounds: match.totalRounds,
    matchStatus: match.matchStatus,
    canSubmitAnswer:
      isParticipant && phase === 'answering' && !hasSubmittedAnswer,
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
      phase === 'guessing' && !isOwnAnswer && !hasGuessedCurrentAnswer
        ? getEligibleOwnerOptions(match, playerId)
        : [],
    revealEntries: revealed ? buildRevealEntries(match, playerId) : [],
    roundResults: revealed ? buildRoundResultEntries(match) : [],
    leaderboard: buildLeaderboardEntries(match),
    resultsLeaderboard: buildResultsLeaderboardEntries(match),
    ...buildRoundResultsInteractionView(match, shell, playerId),
  };
}
