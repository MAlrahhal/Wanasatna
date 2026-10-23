import { randomUUID } from 'node:crypto';
import type { GameShellState, OneWordOnlyPlayerView, OneWordOnlySettings } from '@wanasatna/shared';
import { ONE_WORD_ONLY_GAME_ID } from '@wanasatna/shared';
import {
  ONE_WORD_ONLY_PROVISIONAL_CONTENT,
  type OneWordOnlyContentEntry,
} from './provisional-content.js';
import { normalizeOneWordClue, validateOneWordClue } from './normalization.js';

export const ONE_WORD_ONLY_REVEAL_MS = 10_000;
export const ONE_WORD_ONLY_COMPLETED_MS = 15_000;

type SubmittedClue = { text: string; normalized: string };

export type OneWordOnlyRoundState = {
  roundId: string;
  phase: 'clue-writing' | 'guessing' | 'round-reveal' | 'completed';
  contentId: string;
  answer: string;
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
  guesserPlayerId: string;
  eligibleWriterIds: string[];
  cluesByPlayerId: Record<string, SubmittedClue>;
  survivingPlayerIds: string[];
  removedPlayerIds: string[];
  selectedOptionId: string | null;
  deadlineAtMs: number | null;
  pausedGuessRemainingMs: number | null;
  scored: boolean;
  resultReason: 'correct' | 'wrong' | 'no-answer' | 'guesser-left' | 'insufficient-players' | null;
};

export type OneWordOnlyMatchState = {
  matchId: string;
  playerIds: string[];
  playerNames: Record<string, string>;
  scores: Record<string, number>;
  departedPlayerIds: string[];
  settings: OneWordOnlySettings;
  currentRound: number;
  roundsPlayed: number;
  correctRoundCount: number;
  usedContentIds: string[];
  guesserQueue: string[];
  guessedThisCycle: string[];
  processedRequestIds: string[];
  round: OneWordOnlyRoundState;
};

type ActionResult =
  { ok: true; changed: boolean; match: OneWordOnlyMatchState } | { ok: false; message: string };

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [next[index], next[swap]] = [next[swap]!, next[index]!];
  }
  return next;
}

function chooseContent(
  usedIds: readonly string[],
  random: () => number,
): { entry: OneWordOnlyContentEntry; usedContentIds: string[] } {
  const remaining = ONE_WORD_ONLY_PROVISIONAL_CONTENT.filter(
    (entry) => !usedIds.includes(entry.id),
  );
  const pool = remaining.length > 0 ? remaining : [...ONE_WORD_ONLY_PROVISIONAL_CONTENT];
  const entry = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!;
  return { entry, usedContentIds: remaining.length > 0 ? [...usedIds, entry.id] : [entry.id] };
}

function buildOptions(entry: OneWordOnlyContentEntry, random: () => number) {
  const authored = [entry.answer, ...entry.distractors].map((text) => ({
    id: randomUUID(),
    text,
  }));
  return { options: shuffle(authored, random), correctOptionId: authored[0]!.id };
}

function nextGuesser(input: {
  activePlayerIds: readonly string[];
  queue: readonly string[];
  guessedThisCycle: readonly string[];
  random: () => number;
}): { playerId: string; queue: string[]; guessedThisCycle: string[] } {
  const active = new Set(input.activePlayerIds);
  let queue = input.queue.filter((id) => active.has(id));
  let guessed = input.guessedThisCycle.filter((id) => active.has(id));
  if (queue.length === 0) {
    queue = shuffle(input.activePlayerIds, input.random);
    guessed = [];
  }
  const playerId = queue[0]!;
  return { playerId, queue: queue.slice(1), guessedThisCycle: [...guessed, playerId] };
}

function createRound(input: {
  activePlayerIds: readonly string[];
  queue: readonly string[];
  guessedThisCycle: readonly string[];
  usedContentIds: readonly string[];
  clueSeconds: number;
  random: () => number;
  now: number;
}) {
  const guesser = nextGuesser({
    activePlayerIds: input.activePlayerIds,
    queue: input.queue,
    guessedThisCycle: input.guessedThisCycle,
    random: input.random,
  });
  const content = chooseContent(input.usedContentIds, input.random);
  const optionSet = buildOptions(content.entry, input.random);
  return {
    queue: guesser.queue,
    guessedThisCycle: guesser.guessedThisCycle,
    usedContentIds: content.usedContentIds,
    round: {
      roundId: randomUUID(),
      phase: 'clue-writing' as const,
      contentId: content.entry.id,
      answer: content.entry.answer,
      options: optionSet.options,
      correctOptionId: optionSet.correctOptionId,
      guesserPlayerId: guesser.playerId,
      eligibleWriterIds: input.activePlayerIds.filter((id) => id !== guesser.playerId),
      cluesByPlayerId: {},
      survivingPlayerIds: [],
      removedPlayerIds: [],
      selectedOptionId: null,
      deadlineAtMs: input.now + input.clueSeconds * 1000,
      pausedGuessRemainingMs: null,
      scored: false,
      resultReason: null,
    } satisfies OneWordOnlyRoundState,
  };
}

export function createOneWordOnlyMatch(input: {
  playerIds: readonly string[];
  playerNames: Record<string, string>;
  settings: OneWordOnlySettings;
  random?: () => number;
  now?: number;
}): OneWordOnlyMatchState {
  const playerIds = [...new Set(input.playerIds)];
  const first = createRound({
    activePlayerIds: playerIds,
    queue: [],
    guessedThisCycle: [],
    usedContentIds: [],
    clueSeconds: input.settings.clueSeconds,
    random: input.random ?? Math.random,
    now: input.now ?? Date.now(),
  });
  return {
    matchId: randomUUID(),
    playerIds,
    playerNames: { ...input.playerNames },
    scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
    departedPlayerIds: [],
    settings: { ...input.settings },
    currentRound: 1,
    roundsPlayed: 0,
    correctRoundCount: 0,
    usedContentIds: first.usedContentIds,
    guesserQueue: first.queue,
    guessedThisCycle: first.guessedThisCycle,
    processedRequestIds: [],
    round: first.round,
  };
}

function partitionClues(round: OneWordOnlyRoundState) {
  const groups = new Map<string, string[]>();
  for (const [playerId, clue] of Object.entries(round.cluesByPlayerId)) {
    groups.set(clue.normalized, [...(groups.get(clue.normalized) ?? []), playerId]);
  }
  const survivingPlayerIds: string[] = [];
  const removedPlayerIds: string[] = [];
  for (const ids of groups.values()) {
    (ids.length === 1 ? survivingPlayerIds : removedPlayerIds).push(...ids);
  }
  return { survivingPlayerIds, removedPlayerIds };
}

export function closeOneWordOnlyCluePhase(
  match: OneWordOnlyMatchState,
  guesserConnected: boolean,
  now = Date.now(),
): OneWordOnlyMatchState {
  if (match.round.phase !== 'clue-writing') return match;
  const partition = partitionClues(match.round);
  const fullWindowMs = match.settings.guessSeconds * 1000;
  return {
    ...match,
    round: {
      ...match.round,
      ...partition,
      phase: 'guessing',
      deadlineAtMs: guesserConnected ? now + fullWindowMs : null,
      pausedGuessRemainingMs: guesserConnected ? null : fullWindowMs,
    },
  };
}

export function submitOneWordOnlyClue(
  match: OneWordOnlyMatchState,
  playerId: string,
  payload: { roundId: string; clue: unknown },
  guesserConnected: boolean,
  now = Date.now(),
): ActionResult {
  if (
    match.round.phase !== 'clue-writing' ||
    payload.roundId !== match.round.roundId ||
    (match.round.deadlineAtMs !== null && now >= match.round.deadlineAtMs)
  ) {
    return { ok: false, message: 'انتهت مرحلة كتابة التلميحات.' };
  }
  if (
    !match.round.eligibleWriterIds.includes(playerId) ||
    match.departedPlayerIds.includes(playerId)
  ) {
    return { ok: false, message: 'لا تملك صلاحية إرسال تلميح في هذه الجولة.' };
  }
  if (match.round.cluesByPlayerId[playerId]) {
    return { ok: false, message: 'تم تثبيت تلميحك لهذه الجولة ولا يمكن تعديله.' };
  }
  const parsed = validateOneWordClue(payload.clue);
  if (!parsed.success) return { ok: false, message: parsed.error };
  if (parsed.normalized === normalizeOneWordClue(match.round.answer)) {
    return { ok: false, message: 'لا يمكن أن يكون التلميح هو الإجابة نفسها.' };
  }
  const cluesByPlayerId = {
    ...match.round.cluesByPlayerId,
    [playerId]: { text: parsed.text, normalized: parsed.normalized },
  };
  const next = { ...match, round: { ...match.round, cluesByPlayerId } };
  const outstanding = match.round.eligibleWriterIds.filter(
    (id) => !match.departedPlayerIds.includes(id) && !cluesByPlayerId[id],
  );
  return {
    ok: true,
    changed: true,
    match: outstanding.length === 0 ? closeOneWordOnlyCluePhase(next, guesserConnected, now) : next,
  };
}

function revealRound(
  match: OneWordOnlyMatchState,
  selectedOptionId: string | null,
  reason: OneWordOnlyRoundState['resultReason'],
  now: number,
): OneWordOnlyMatchState {
  if (match.round.scored) return match;
  const correct = selectedOptionId === match.round.correctOptionId;
  return {
    ...match,
    roundsPlayed: match.roundsPlayed + 1,
    correctRoundCount: match.correctRoundCount + (correct ? 1 : 0),
    round: {
      ...match.round,
      phase: 'round-reveal',
      selectedOptionId,
      deadlineAtMs: now + ONE_WORD_ONLY_REVEAL_MS,
      pausedGuessRemainingMs: null,
      scored: true,
      resultReason: correct ? 'correct' : reason,
    },
  };
}

export function confirmOneWordOnlyAnswer(
  match: OneWordOnlyMatchState,
  playerId: string,
  payload: { roundId: string; optionId: string; requestId: string },
  now = Date.now(),
): ActionResult {
  if (match.processedRequestIds.includes(payload.requestId)) {
    return { ok: false, message: 'تم اعتماد هذه المحاولة مسبقًا.' };
  }
  if (
    match.round.phase !== 'guessing' ||
    payload.roundId !== match.round.roundId ||
    match.round.deadlineAtMs === null ||
    now >= match.round.deadlineAtMs
  ) {
    return { ok: false, message: 'التأكيد غير متاح الآن أو يخص جولة سابقة.' };
  }
  if (match.round.guesserPlayerId !== playerId || match.departedPlayerIds.includes(playerId)) {
    return { ok: false, message: 'المخمّن المعيّن فقط يستطيع تأكيد الإجابة.' };
  }
  if (!match.round.options.some((option) => option.id === payload.optionId)) {
    return { ok: false, message: 'الخيار المحدد غير صالح.' };
  }
  const withRequest = {
    ...match,
    processedRequestIds: [...match.processedRequestIds, payload.requestId].slice(-100),
  };
  return {
    ok: true,
    changed: true,
    match: revealRound(withRequest, payload.optionId, 'wrong', now),
  };
}

function activeIds(match: OneWordOnlyMatchState): string[] {
  const departed = new Set(match.departedPlayerIds);
  return match.playerIds.filter((id) => !departed.has(id));
}

function completeMatch(
  match: OneWordOnlyMatchState,
  reason: OneWordOnlyRoundState['resultReason'],
  now: number,
): OneWordOnlyMatchState {
  return {
    ...match,
    round: {
      ...match.round,
      phase: 'completed',
      deadlineAtMs: now + ONE_WORD_ONLY_COMPLETED_MS,
      pausedGuessRemainingMs: null,
      resultReason: reason,
    },
  };
}

export function advanceOneWordOnlyRound(
  match: OneWordOnlyMatchState,
  participants: readonly { playerId: string; name: string }[],
  requestId: string | null,
  now = Date.now(),
  random: () => number = Math.random,
  newlyEligiblePlayerIds: readonly string[] = [],
): ActionResult {
  if (match.round.phase !== 'round-reveal') {
    return { ok: false, message: 'لا يمكن الانتقال في هذه المرحلة.' };
  }
  if (requestId && match.processedRequestIds.includes(requestId)) {
    return { ok: true, changed: false, match };
  }
  const departed = new Set(match.departedPlayerIds);
  const playerIds = [...match.playerIds];
  const playerNames = { ...match.playerNames };
  const scores = { ...match.scores };
  const guesserQueue = [...match.guesserQueue];
  const newlyEligible = new Set(newlyEligiblePlayerIds);
  for (const participant of participants) {
    if (departed.has(participant.playerId)) continue;
    playerNames[participant.playerId] = participant.name;
    if (!playerIds.includes(participant.playerId)) {
      playerIds.push(participant.playerId);
      scores[participant.playerId] = 0;
      newlyEligible.add(participant.playerId);
    }
    if (
      newlyEligible.has(participant.playerId) &&
      !match.guessedThisCycle.includes(participant.playerId) &&
      !guesserQueue.includes(participant.playerId)
    ) {
      guesserQueue.push(participant.playerId);
    }
  }
  const expanded = { ...match, playerIds, playerNames, scores, guesserQueue };
  const activePlayerIds = activeIds(expanded);
  const processedRequestIds = requestId
    ? [...match.processedRequestIds, requestId].slice(-100)
    : match.processedRequestIds;
  if (activePlayerIds.length < 3 || match.currentRound >= match.settings.roundCount) {
    return {
      ok: true,
      changed: true,
      match: completeMatch(
        { ...expanded, processedRequestIds },
        activePlayerIds.length < 3 ? 'insufficient-players' : match.round.resultReason,
        now,
      ),
    };
  }
  const next = createRound({
    activePlayerIds,
    queue: guesserQueue,
    guessedThisCycle: match.guessedThisCycle,
    usedContentIds: match.usedContentIds,
    clueSeconds: match.settings.clueSeconds,
    random,
    now,
  });
  return {
    ok: true,
    changed: true,
    match: {
      ...expanded,
      processedRequestIds,
      currentRound: match.currentRound + 1,
      guesserQueue: next.queue,
      guessedThisCycle: next.guessedThisCycle,
      usedContentIds: next.usedContentIds,
      round: next.round,
    },
  };
}

export function expireOneWordOnlyPhase(
  match: OneWordOnlyMatchState,
  expectedRoundId: string,
  expectedPhase: OneWordOnlyRoundState['phase'],
  guesserConnected: boolean,
  now = Date.now(),
): OneWordOnlyMatchState | null {
  if (
    match.round.roundId !== expectedRoundId ||
    match.round.phase !== expectedPhase ||
    match.round.deadlineAtMs === null ||
    now < match.round.deadlineAtMs
  )
    return null;
  if (expectedPhase === 'clue-writing')
    return closeOneWordOnlyCluePhase(match, guesserConnected, now);
  if (expectedPhase === 'guessing') return revealRound(match, null, 'no-answer', now);
  return null;
}

export function reconcileOneWordOnlyGuesserConnection(
  match: OneWordOnlyMatchState,
  connected: boolean,
  now = Date.now(),
): OneWordOnlyMatchState {
  if (match.round.phase !== 'guessing') return match;
  if (!connected && match.round.deadlineAtMs !== null) {
    return {
      ...match,
      round: {
        ...match.round,
        pausedGuessRemainingMs: Math.max(0, match.round.deadlineAtMs - now),
        deadlineAtMs: null,
      },
    };
  }
  if (
    connected &&
    match.round.deadlineAtMs === null &&
    match.round.pausedGuessRemainingMs !== null
  ) {
    return {
      ...match,
      round: {
        ...match.round,
        deadlineAtMs: now + match.round.pausedGuessRemainingMs,
        pausedGuessRemainingMs: null,
      },
    };
  }
  return match;
}

export function handleOneWordOnlyPermanentLeave(
  match: OneWordOnlyMatchState,
  playerId: string,
  now = Date.now(),
): OneWordOnlyMatchState {
  if (!match.playerIds.includes(playerId) || match.departedPlayerIds.includes(playerId))
    return match;
  const next = { ...match, departedPlayerIds: [...match.departedPlayerIds, playerId] };
  if (match.round.phase === 'completed') return next;
  if (activeIds(next).length < 3) {
    const readyToReveal =
      match.round.phase === 'clue-writing' ? closeOneWordOnlyCluePhase(next, false, now) : next;
    const revealed =
      match.round.phase === 'round-reveal'
        ? readyToReveal
        : revealRound(readyToReveal, null, 'insufficient-players', now);
    return { ...revealed, round: { ...revealed.round, resultReason: 'insufficient-players' } };
  }
  if (
    match.round.guesserPlayerId === playerId &&
    (match.round.phase === 'clue-writing' || match.round.phase === 'guessing')
  ) {
    const readyToReveal =
      match.round.phase === 'clue-writing' ? closeOneWordOnlyCluePhase(next, false, now) : next;
    return revealRound(readyToReveal, null, 'guesser-left', now);
  }
  return next;
}

export function buildOneWordOnlyPlayerView(
  match: OneWordOnlyMatchState,
  playerId: string,
  shell: GameShellState,
  now = Date.now(),
): OneWordOnlyPlayerView {
  const departed = match.departedPlayerIds.includes(playerId);
  const isParticipant = match.playerIds.includes(playerId) && !departed;
  const isGuesser = match.round.guesserPlayerId === playerId;
  const revealed = match.round.phase === 'round-reveal' || match.round.phase === 'completed';
  const selected = match.round.options.find((option) => option.id === match.round.selectedOptionId);
  return {
    gameId: ONE_WORD_ONLY_GAME_ID,
    selfPlayerId: playerId,
    settings: { ...match.settings },
    phase: match.round.phase,
    currentRound: match.currentRound,
    totalRounds: match.settings.roundCount,
    roundsPlayed: match.roundsPlayed,
    correctRoundCount: match.correctRoundCount,
    roundId: match.round.roundId,
    guesserPlayerId: match.round.guesserPlayerId,
    guesserName: match.playerNames[match.round.guesserPlayerId] ?? 'لاعب',
    isGuesser,
    isSpectator: !isParticipant,
    isHost: shell.hostPlayerId === playerId,
    canSubmitClue:
      isParticipant &&
      !isGuesser &&
      match.round.phase === 'clue-writing' &&
      !match.round.cluesByPlayerId[playerId],
    canConfirmAnswer:
      isParticipant &&
      isGuesser &&
      match.round.phase === 'guessing' &&
      match.round.deadlineAtMs !== null,
    canAdvance: shell.hostPlayerId === playerId && match.round.phase === 'round-reveal',
    privateAnswer:
      isParticipant && !isGuesser && match.round.phase === 'clue-writing'
        ? match.round.answer
        : null,
    ownSubmittedClue: match.round.cluesByPlayerId[playerId]?.text ?? null,
    submittedClueCount: Object.keys(match.round.cluesByPlayerId).length,
    eligibleClueWriterCount: match.round.eligibleWriterIds.length,
    survivingClues:
      match.round.phase === 'guessing' || revealed
        ? match.round.survivingPlayerIds.map((id) => match.round.cluesByPlayerId[id]!.text)
        : [],
    answerOptions:
      match.round.phase === 'guessing' || revealed
        ? match.round.options.map((option) => ({ ...option }))
        : [],
    revealedCorrectAnswer: revealed ? match.round.answer : null,
    revealedSelectedAnswer: revealed ? (selected?.text ?? null) : null,
    roundWasCorrect: revealed ? match.round.resultReason === 'correct' : null,
    revealClues: revealed
      ? Object.entries(match.round.cluesByPlayerId).map(([id, clue]) => ({
          playerId: id,
          playerName: match.playerNames[id] ?? 'لاعب',
          text: clue.text,
          survived: match.round.survivingPlayerIds.includes(id),
        }))
      : [],
    deadlineAtMs: match.round.deadlineAtMs,
    remainingSeconds:
      match.round.deadlineAtMs === null
        ? null
        : Math.max(0, Math.ceil((match.round.deadlineAtMs - now) / 1000)),
    waitingForGuesser: match.round.phase === 'guessing' && match.round.deadlineAtMs === null,
    resultReason: revealed ? match.round.resultReason : null,
  };
}
