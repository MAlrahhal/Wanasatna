import { randomUUID } from 'node:crypto';
import type {
  GameShellState,
  MostLikelyToAggregateResult,
  MostLikelyToNominee,
  MostLikelyToNomineeResult,
  MostLikelyToPlayerView,
  MostLikelyToQuestionResult,
  MostLikelyToVoteDisclosure,
} from '@wanasatna/shared';
import {
  MOST_LIKELY_TO_GAME_ID,
  MOST_LIKELY_TO_MAX_PLAYERS,
  MOST_LIKELY_TO_MIN_PLAYERS,
  MOST_LIKELY_TO_QUESTION_COUNT,
  MOST_LIKELY_TO_VOTE_SECONDS,
} from '@wanasatna/shared';
import {
  MOST_LIKELY_TO_PROVISIONAL_QUESTIONS,
  type MostLikelyToQuestionDefinition,
} from './provisional-questions.js';

export type MostLikelyToQuestionState = {
  questionId: string;
  contentId: string;
  text: string;
  roster: MostLikelyToNominee[];
  votesByVoterId: Record<string, string>;
  deadlineAtMs: number | null;
};

export type MostLikelyToMatchState = {
  matchId: string;
  playerIds: string[];
  playerNames: Record<string, string>;
  departedPlayerIds: string[];
  questions: MostLikelyToQuestionDefinition[];
  currentQuestionIndex: number;
  phase: 'voting' | 'reveal' | 'completed';
  currentQuestion: MostLikelyToQuestionState;
  history: MostLikelyToQuestionResult[];
  processedRequestIds: string[];
};

export type MostLikelyToActionResult =
  { ok: true; match: MostLikelyToMatchState; changed: boolean } | { ok: false; message: string };

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [next[index], next[target]] = [next[target]!, next[index]!];
  }
  return next;
}

export function selectMostLikelyToQuestions(
  random: () => number = Math.random,
  bank: readonly MostLikelyToQuestionDefinition[] = MOST_LIKELY_TO_PROVISIONAL_QUESTIONS,
): MostLikelyToQuestionDefinition[] {
  if (bank.length < MOST_LIKELY_TO_QUESTION_COUNT) {
    throw new Error('Most Likely To needs at least ten distinct questions.');
  }
  const selected = shuffle(bank, random).slice(0, MOST_LIKELY_TO_QUESTION_COUNT);
  if (new Set(selected.map((question) => question.id)).size !== MOST_LIKELY_TO_QUESTION_COUNT) {
    throw new Error('Most Likely To match questions must be distinct.');
  }
  return selected;
}

function questionState(
  question: MostLikelyToQuestionDefinition,
  roster: readonly MostLikelyToNominee[],
  now: number,
): MostLikelyToQuestionState {
  return {
    questionId: randomUUID(),
    contentId: question.id,
    text: question.text,
    roster: roster.map((participant) => ({ ...participant })),
    votesByVoterId: {},
    deadlineAtMs: now + MOST_LIKELY_TO_VOTE_SECONDS * 1000,
  };
}

function validateParticipants(participants: readonly MostLikelyToNominee[]): void {
  if (
    participants.length < MOST_LIKELY_TO_MIN_PLAYERS ||
    participants.length > MOST_LIKELY_TO_MAX_PLAYERS ||
    new Set(participants.map((participant) => participant.playerId)).size !== participants.length
  ) {
    throw new Error('Most Likely To requires 3–15 distinct participants.');
  }
}

export function createMostLikelyToMatch(input: {
  participants: readonly MostLikelyToNominee[];
  random?: () => number;
  now?: number;
}): MostLikelyToMatchState {
  validateParticipants(input.participants);
  const questions = selectMostLikelyToQuestions(input.random);
  const now = input.now ?? Date.now();
  return {
    matchId: randomUUID(),
    playerIds: input.participants.map((participant) => participant.playerId),
    playerNames: Object.fromEntries(
      input.participants.map((participant) => [participant.playerId, participant.name]),
    ),
    departedPlayerIds: [],
    questions,
    currentQuestionIndex: 0,
    phase: 'voting',
    currentQuestion: questionState(questions[0]!, input.participants, now),
    history: [],
    processedRequestIds: [],
  };
}

function validRequestId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 100;
}

function withProcessed(match: MostLikelyToMatchState, requestId: string): MostLikelyToMatchState {
  return {
    ...match,
    processedRequestIds: [...match.processedRequestIds, requestId].slice(-200),
  };
}

function buildQuestionResult(match: MostLikelyToMatchState): MostLikelyToQuestionResult {
  const rosterById = new Map(
    match.currentQuestion.roster.map((participant) => [participant.playerId, participant]),
  );
  const counts = new Map(
    match.currentQuestion.roster.map((participant) => [participant.playerId, 0]),
  );
  const voterNames = new Map(
    match.currentQuestion.roster.map((participant) => [participant.playerId, [] as string[]]),
  );
  const votes: MostLikelyToVoteDisclosure[] = [];

  for (const voter of match.currentQuestion.roster) {
    const nomineePlayerId = match.currentQuestion.votesByVoterId[voter.playerId];
    const nominee = nomineePlayerId ? rosterById.get(nomineePlayerId) : null;
    if (!nominee) continue;
    counts.set(nominee.playerId, (counts.get(nominee.playerId) ?? 0) + 1);
    voterNames.get(nominee.playerId)?.push(voter.name);
    votes.push({
      voterPlayerId: voter.playerId,
      voterName: voter.name,
      nomineePlayerId: nominee.playerId,
      nomineeName: nominee.name,
    });
  }

  const nominees: MostLikelyToNomineeResult[] = match.currentQuestion.roster.map((nominee) => ({
    ...nominee,
    voteCount: counts.get(nominee.playerId) ?? 0,
    voterNames: voterNames.get(nominee.playerId) ?? [],
  }));
  const maximum = Math.max(0, ...nominees.map((nominee) => nominee.voteCount));

  return {
    questionId: match.currentQuestion.questionId,
    questionNumber: match.currentQuestionIndex + 1,
    question: match.currentQuestion.text,
    nominees,
    votes,
    topNomineePlayerIds:
      maximum > 0
        ? nominees
            .filter((nominee) => nominee.voteCount === maximum)
            .map((nominee) => nominee.playerId)
        : [],
    totalVotes: votes.length,
  };
}

export function revealMostLikelyToQuestion(match: MostLikelyToMatchState): MostLikelyToMatchState {
  if (match.phase !== 'voting') return match;
  const result = buildQuestionResult(match);
  const history = [...match.history, result];
  return {
    ...match,
    phase:
      match.currentQuestionIndex === MOST_LIKELY_TO_QUESTION_COUNT - 1 ? 'completed' : 'reveal',
    currentQuestion: { ...match.currentQuestion, deadlineAtMs: null },
    history,
  };
}

export function voteMostLikelyTo(
  match: MostLikelyToMatchState,
  playerId: string,
  payload: { questionId?: unknown; nomineePlayerId?: unknown; requestId?: unknown },
  now = Date.now(),
): MostLikelyToActionResult {
  if (!validRequestId(payload.requestId)) {
    return { ok: false, message: 'طلب التصويت غير صالح.' };
  }
  if (match.processedRequestIds.includes(payload.requestId)) {
    return { ok: true, match, changed: false };
  }
  if (
    match.phase !== 'voting' ||
    payload.questionId !== match.currentQuestion.questionId ||
    match.currentQuestion.deadlineAtMs === null ||
    now >= match.currentQuestion.deadlineAtMs
  ) {
    return { ok: false, message: 'انتهى التصويت لهذا السؤال.' };
  }
  if (!match.currentQuestion.roster.some((participant) => participant.playerId === playerId)) {
    return { ok: false, message: 'ستتمكن من التصويت ابتداءً من السؤال التالي.' };
  }
  if (
    typeof payload.nomineePlayerId !== 'string' ||
    !match.currentQuestion.roster.some(
      (participant) => participant.playerId === payload.nomineePlayerId,
    )
  ) {
    return { ok: false, message: 'الشخص المختار غير متاح في هذا السؤال.' };
  }

  let next = withProcessed(
    {
      ...match,
      currentQuestion: {
        ...match.currentQuestion,
        votesByVoterId: {
          ...match.currentQuestion.votesByVoterId,
          [playerId]: payload.nomineePlayerId,
        },
      },
    },
    payload.requestId,
  );
  if (
    Object.keys(next.currentQuestion.votesByVoterId).length === next.currentQuestion.roster.length
  ) {
    next = revealMostLikelyToQuestion(next);
  }
  return { ok: true, match: next, changed: true };
}

export function settleMostLikelyToDeadline(
  match: MostLikelyToMatchState,
  now = Date.now(),
): MostLikelyToMatchState {
  if (
    match.phase !== 'voting' ||
    match.currentQuestion.deadlineAtMs === null ||
    now < match.currentQuestion.deadlineAtMs
  ) {
    return match;
  }
  return revealMostLikelyToQuestion(match);
}

export function startNextMostLikelyToQuestion(
  match: MostLikelyToMatchState,
  participants: readonly MostLikelyToNominee[],
  requestId: string,
  now = Date.now(),
): MostLikelyToActionResult {
  if (!validRequestId(requestId)) {
    return { ok: false, message: 'طلب الانتقال غير صالح.' };
  }
  if (match.processedRequestIds.includes(requestId)) {
    return { ok: true, match, changed: false };
  }
  if (match.phase !== 'reveal') {
    return { ok: false, message: 'لا يمكن الانتقال الآن.' };
  }
  const eligible = participants
    .filter((participant) => !match.departedPlayerIds.includes(participant.playerId))
    .slice(0, MOST_LIKELY_TO_MAX_PLAYERS);
  if (eligible.length === 0) {
    return { ok: false, message: 'لا يوجد لاعبون متاحون للسؤال التالي.' };
  }
  const nextIndex = match.currentQuestionIndex + 1;
  const nextQuestion = match.questions[nextIndex];
  if (!nextQuestion) {
    return { ok: false, message: 'اكتملت أسئلة المباراة.' };
  }
  return {
    ok: true,
    changed: true,
    match: withProcessed(
      {
        ...match,
        playerIds: [...new Set([...match.playerIds, ...eligible.map((entry) => entry.playerId)])],
        playerNames: {
          ...match.playerNames,
          ...Object.fromEntries(eligible.map((entry) => [entry.playerId, entry.name])),
        },
        currentQuestionIndex: nextIndex,
        phase: 'voting',
        currentQuestion: questionState(nextQuestion, eligible, now),
      },
      requestId,
    ),
  };
}

export function markMostLikelyToPlayerDeparted(
  match: MostLikelyToMatchState,
  playerId: string,
): MostLikelyToMatchState {
  if (match.departedPlayerIds.includes(playerId) || !match.playerIds.includes(playerId)) {
    return match;
  }
  return { ...match, departedPlayerIds: [...match.departedPlayerIds, playerId] };
}

export function buildMostLikelyToAggregate(
  history: readonly MostLikelyToQuestionResult[],
): MostLikelyToAggregateResult {
  const nominees = new Map<string, MostLikelyToNomineeResult>();
  let totalVotes = 0;
  for (const result of history) {
    totalVotes += result.totalVotes;
    for (const nominee of result.nominees) {
      const current = nominees.get(nominee.playerId);
      nominees.set(nominee.playerId, {
        playerId: nominee.playerId,
        name: nominee.name,
        voteCount: (current?.voteCount ?? 0) + nominee.voteCount,
        voterNames: [],
      });
    }
  }
  const values = [...nominees.values()];
  const maximum = Math.max(0, ...values.map((nominee) => nominee.voteCount));
  return {
    nominees: values.sort((left, right) => right.voteCount - left.voteCount),
    topNomineePlayerIds:
      maximum > 0
        ? values
            .filter((nominee) => nominee.voteCount === maximum)
            .map((nominee) => nominee.playerId)
        : [],
    totalVotes,
  };
}

export function buildMostLikelyToPlayerView(
  match: MostLikelyToMatchState,
  playerId: string,
  shell: Pick<GameShellState, 'hostPlayerId'>,
  now = Date.now(),
): MostLikelyToPlayerView {
  const isEligible = match.currentQuestion.roster.some(
    (participant) => participant.playerId === playerId,
  );
  const result = match.history.at(-1) ?? null;
  const revealed = match.phase !== 'voting';
  return {
    gameId: MOST_LIKELY_TO_GAME_ID,
    selfPlayerId: playerId,
    phase: match.phase,
    questionId: match.currentQuestion.questionId,
    questionNumber: match.currentQuestionIndex + 1,
    totalQuestions: MOST_LIKELY_TO_QUESTION_COUNT,
    question: match.currentQuestion.text,
    nominees: match.currentQuestion.roster.map((nominee) => ({ ...nominee })),
    eligibleVoterCount: match.currentQuestion.roster.length,
    submittedVoteCount: Object.keys(match.currentQuestion.votesByVoterId).length,
    ownVotePlayerId:
      match.phase === 'voting' ? (match.currentQuestion.votesByVoterId[playerId] ?? null) : null,
    canVote: match.phase === 'voting' && isEligible,
    isWaitingForNextQuestion: match.phase === 'voting' && !isEligible,
    deadlineAtMs: match.phase === 'voting' ? match.currentQuestion.deadlineAtMs : null,
    remainingSeconds:
      match.phase === 'voting' && match.currentQuestion.deadlineAtMs !== null
        ? Math.max(0, Math.ceil((match.currentQuestion.deadlineAtMs - now) / 1000))
        : null,
    result: revealed ? result : null,
    recap: match.phase === 'completed' ? match.history.map((entry) => ({ ...entry })) : [],
    aggregate: match.phase === 'completed' ? buildMostLikelyToAggregate(match.history) : null,
    canAdvance: match.phase !== 'voting' && shell.hostPlayerId === playerId,
  };
}
