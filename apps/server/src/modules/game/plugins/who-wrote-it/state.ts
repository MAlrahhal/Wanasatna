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

export function getGuessableAnswerIds(
  match: WhoWroteItMatchState,
  playerId: string,
): string[] {
  return match.round.shuffledAnswerIds.filter((answerId) => {
    const answer = findAnswerById(match, answerId);
    return Boolean(answer && answer.ownerPlayerId !== playerId);
  });
}

export function getPlayerGuessMap(
  match: WhoWroteItMatchState,
  playerId: string,
): Record<string, string> {
  return match.round.guessesByPlayerId[playerId] ?? {};
}

export function hasCompletedGuessing(
  match: WhoWroteItMatchState,
  playerId: string,
): boolean {
  const guessable = getGuessableAnswerIds(match, playerId);
  if (guessable.length === 0) {
    return true;
  }

  const guesses = getPlayerGuessMap(match, playerId);
  return guessable.every((answerId) => Boolean(guesses[answerId]));
}

export function getCurrentGuessAnswerId(
  match: WhoWroteItMatchState,
  playerId: string,
): string | null {
  const guessable = getGuessableAnswerIds(match, playerId);
  const guesses = getPlayerGuessMap(match, playerId);
  return guessable.find((answerId) => !guesses[answerId]) ?? null;
}

export function getUsedOwnerIds(
  match: WhoWroteItMatchState,
  playerId: string,
): Set<string> {
  return new Set(Object.values(getPlayerGuessMap(match, playerId)));
}

export function getEligibleOwnerOptions(
  match: WhoWroteItMatchState,
  playerId: string,
): Array<{ playerId: string; name: string }> {
  const usedOwners = getUsedOwnerIds(match, playerId);
  const answerOwners = new Set(match.round.answers.map((answer) => answer.ownerPlayerId));

  return match.playerIds
    .filter(
      (ownerId) =>
        ownerId !== playerId && answerOwners.has(ownerId) && !usedOwners.has(ownerId),
    )
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

export function allConnectedHaveGuessed(
  match: WhoWroteItMatchState,
  shell: GameShellState,
): boolean {
  const connected = getConnectedParticipantIds(match, shell);
  if (connected.length === 0) {
    return false;
  }

  return connected.every((playerId) => hasCompletedGuessing(match, playerId));
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
    guessesByPlayerId: {},
  });
}

/**
 * Apply a validated owner guess and auto-assign the final remaining pair if needed.
 */
export function applyOwnerGuess(
  match: WhoWroteItMatchState,
  playerId: string,
  answerId: string,
  ownerPlayerId: string,
): WhoWroteItMatchState {
  const existingGuesses = { ...getPlayerGuessMap(match, playerId) };
  existingGuesses[answerId] = ownerPlayerId;

  let nextMatch = withRound(match, {
    ...match.round,
    guessesByPlayerId: {
      ...match.round.guessesByPlayerId,
      [playerId]: existingGuesses,
    },
  });

  const remainingAnswerIds = getGuessableAnswerIds(nextMatch, playerId).filter(
    (id) => !existingGuesses[id],
  );
  const remainingOwners = getEligibleOwnerOptions(nextMatch, playerId);

  if (remainingAnswerIds.length === 1 && remainingOwners.length === 1) {
    const finalAnswerId = remainingAnswerIds[0]!;
    const finalOwnerId = remainingOwners[0]!.playerId;
    existingGuesses[finalAnswerId] = finalOwnerId;
    nextMatch = withRound(nextMatch, {
      ...nextMatch.round,
      guessesByPlayerId: {
        ...nextMatch.round.guessesByPlayerId,
        [playerId]: { ...existingGuesses },
      },
    });
  }

  return nextMatch;
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
      const guessedOwnerPlayerId = guesses[answer.answerId] ?? null;
      return {
        answerId: answer.answerId,
        text: answer.text,
        ownerPlayerId: answer.ownerPlayerId,
        ownerName: match.playerNames[answer.ownerPlayerId] ?? 'لاعب',
        guessedOwnerPlayerId,
        guessedOwnerName: guessedOwnerPlayerId
          ? (match.playerNames[guessedOwnerPlayerId] ?? 'لاعب')
          : null,
        isCorrect: guessedOwnerPlayerId === answer.ownerPlayerId,
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

  const guessable = getGuessableAnswerIds(match, playerId);
  const guesses = getPlayerGuessMap(match, playerId);
  const completedGuessCount = guessable.filter((answerId) => Boolean(guesses[answerId])).length;
  const currentAnswerId =
    phase === 'guessing' && !hasCompletedGuessing(match, playerId)
      ? getCurrentGuessAnswerId(match, playerId)
      : null;
  const currentAnswer = currentAnswerId ? findAnswerById(match, currentAnswerId) : null;

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
    guessingProgressIndex: Math.min(completedGuessCount + 1, Math.max(guessable.length, 1)),
    guessingProgressTotal: guessable.length,
    guessOptions:
      phase === 'guessing' && currentAnswerId
        ? getEligibleOwnerOptions(match, playerId)
        : [],
    hasCompletedGuessing: phase === 'guessing' ? hasCompletedGuessing(match, playerId) : false,
    revealEntries: revealed ? buildRevealEntries(match, playerId) : [],
    roundResults: revealed ? buildRoundResultEntries(match) : [],
    leaderboard: buildLeaderboardEntries(match),
    resultsLeaderboard: buildResultsLeaderboardEntries(match),
    ...buildRoundResultsInteractionView(match, shell, playerId),
  };
}
