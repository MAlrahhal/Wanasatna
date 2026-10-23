import { randomUUID } from 'node:crypto';
import type {
  EmojiLanguageGuessFeedback,
  EmojiLanguageLeaderboardEntry,
  EmojiLanguagePlayerView,
  EmojiLanguageRoundResultEntry,
  EmojiLanguageSettings,
  GameShellState,
} from '@wanasatna/shared';
import {
  EMOJI_LANGUAGE_GAME_ID,
  EMOJI_LANGUAGE_PICKER,
  normalizeTextAnswer,
} from '@wanasatna/shared';
import {
  EMOJI_LANGUAGE_PLAYER_PROMPTS,
  EMOJI_LANGUAGE_SERVER_PUZZLES,
  type EmojiLanguageAnswerPrompt,
} from './provisional-content.js';

export const EMOJI_LANGUAGE_GUESS_COOLDOWN_MS = 750;
export const EMOJI_LANGUAGE_ROUND_RESULTS_MS = 8_000;
export const EMOJI_LANGUAGE_MATCH_RESULTS_MS = 12_000;

type ProcessedGuess = {
  requestId: string;
  playerId: string;
  feedback: EmojiLanguageGuessFeedback;
};

export type EmojiLanguageRoundState = {
  roundId: string;
  phase: 'preparation' | 'guessing' | 'round-results' | 'completed';
  contentId: string;
  answer: string;
  acceptedAnswers: string[];
  writerPlayerId: string | null;
  clue: string[] | null;
  deadlineAtMs: number | null;
  correctAnswerPlayerIds: string[];
  attemptCountByPlayerId: Record<string, number>;
  lastAttemptAtMsByPlayerId: Record<string, number>;
  processedGuesses: ProcessedGuess[];
  scored: boolean;
  resultReason: 'answered' | 'no-correct-answer' | 'no-clue' | 'insufficient-players' | null;
};

export type EmojiLanguageMatchState = {
  matchId: string;
  playerIds: string[];
  writerRotationPlayerIds: string[];
  playerNames: Record<string, string>;
  departedPlayerIds: string[];
  settings: EmojiLanguageSettings;
  currentRound: number;
  scores: Record<string, number>;
  usedContentIds: string[];
  round: EmojiLanguageRoundState;
};

type ActionResult =
  { ok: true; match: EmojiLanguageMatchState; changed: boolean } | { ok: false; message: string };

type GuessActionResult =
  | {
      ok: true;
      match: EmojiLanguageMatchState;
      changed: boolean;
      feedback: EmojiLanguageGuessFeedback;
    }
  | { ok: false; message: string; cooldownMs?: number };

function chooseContent<T extends EmojiLanguageAnswerPrompt>(
  values: readonly T[],
  usedContentIds: readonly string[],
  random: () => number,
): { entry: T; usedContentIds: string[] } {
  const remaining = values.filter((entry) => !usedContentIds.includes(entry.id));
  const pool = remaining.length > 0 ? remaining : [...values];
  const entry = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!;
  return {
    entry,
    usedContentIds: remaining.length > 0 ? [...usedContentIds, entry.id] : [entry.id],
  };
}

function nextWriterPlayerId(
  playerIds: readonly string[],
  departedPlayerIds: readonly string[],
  roundNumber: number,
): string | null {
  if (playerIds.length === 0) return null;
  const departed = new Set(departedPlayerIds);
  const startingIndex = (roundNumber - 1) % playerIds.length;
  for (let offset = 0; offset < playerIds.length; offset += 1) {
    const candidate = playerIds[(startingIndex + offset) % playerIds.length]!;
    if (!departed.has(candidate)) return candidate;
  }
  return null;
}

function createRound(input: {
  settings: EmojiLanguageSettings;
  playerIds: readonly string[];
  departedPlayerIds: readonly string[];
  roundNumber: number;
  usedContentIds: readonly string[];
  random: () => number;
  now: number;
}): { round: EmojiLanguageRoundState; usedContentIds: string[] } {
  const bank =
    input.settings.mode === 'player-clue'
      ? EMOJI_LANGUAGE_PLAYER_PROMPTS
      : EMOJI_LANGUAGE_SERVER_PUZZLES;
  const selected = chooseContent(bank, input.usedContentIds, input.random);
  const serverPuzzle =
    input.settings.mode === 'server-puzzle'
      ? EMOJI_LANGUAGE_SERVER_PUZZLES.find((entry) => entry.id === selected.entry.id)!
      : null;
  const phase = input.settings.mode === 'player-clue' ? 'preparation' : 'guessing';

  return {
    usedContentIds: selected.usedContentIds,
    round: {
      roundId: randomUUID(),
      phase,
      contentId: selected.entry.id,
      answer: selected.entry.answer,
      acceptedAnswers: [...selected.entry.acceptedAnswers],
      writerPlayerId:
        input.settings.mode === 'player-clue'
          ? nextWriterPlayerId(input.playerIds, input.departedPlayerIds, input.roundNumber)
          : null,
      clue: serverPuzzle ? [...serverPuzzle.emojis] : null,
      deadlineAtMs:
        input.now +
        (phase === 'preparation'
          ? input.settings.preparationSeconds
          : input.settings.guessingSeconds) *
          1000,
      correctAnswerPlayerIds: [],
      attemptCountByPlayerId: {},
      lastAttemptAtMsByPlayerId: {},
      processedGuesses: [],
      scored: false,
      resultReason: null,
    },
  };
}

export function createEmojiLanguageMatch(input: {
  playerIds: readonly string[];
  playerNames: Record<string, string>;
  settings: EmojiLanguageSettings;
  random?: () => number;
  now?: number;
}): EmojiLanguageMatchState {
  const now = input.now ?? Date.now();
  const playerIds = [...new Set(input.playerIds)];
  const first = createRound({
    settings: input.settings,
    playerIds,
    departedPlayerIds: [],
    roundNumber: 1,
    usedContentIds: [],
    random: input.random ?? Math.random,
    now,
  });
  return {
    matchId: randomUUID(),
    playerIds,
    writerRotationPlayerIds: [...playerIds],
    playerNames: { ...input.playerNames },
    departedPlayerIds: [],
    settings: { ...input.settings },
    currentRound: 1,
    scores: Object.fromEntries(playerIds.map((playerId) => [playerId, 0])),
    usedContentIds: first.usedContentIds,
    round: first.round,
  };
}

function pointsForPlacement(placement: number): number {
  return [100, 75, 50][placement - 1] ?? 25;
}

function isCorrectAnswer(answer: string, acceptedAnswers: readonly string[]): boolean {
  const normalized = normalizeTextAnswer(answer);
  return Boolean(
    normalized &&
    acceptedAnswers.some((candidate) => normalizeTextAnswer(candidate) === normalized),
  );
}

export function submitEmojiLanguageClue(
  match: EmojiLanguageMatchState,
  playerId: string,
  payload: { roundId: string; emojis: unknown },
  now = Date.now(),
): ActionResult {
  if (
    match.settings.mode !== 'player-clue' ||
    match.round.phase !== 'preparation' ||
    match.round.roundId !== payload.roundId
  ) {
    return { ok: false, message: 'انتهت مرحلة إعداد التلميح.' };
  }
  if (match.round.writerPlayerId !== playerId) {
    return { ok: false, message: 'إرسال التلميح متاح لكاتب الجولة فقط.' };
  }
  if (match.round.deadlineAtMs !== null && now >= match.round.deadlineAtMs) {
    return { ok: false, message: 'انتهى وقت إعداد التلميح.' };
  }
  if (!Array.isArray(payload.emojis) || payload.emojis.length < 1 || payload.emojis.length > 10) {
    return { ok: false, message: 'اختر من 1 إلى 10 رموز من لوحة اللعبة.' };
  }
  const approved = new Set<string>(EMOJI_LANGUAGE_PICKER);
  if (payload.emojis.some((emoji) => typeof emoji !== 'string' || !approved.has(emoji))) {
    return { ok: false, message: 'يتضمن التلميح رمزًا غير مسموح.' };
  }
  return {
    ok: true,
    changed: true,
    match: {
      ...match,
      round: {
        ...match.round,
        phase: 'guessing',
        clue: [...payload.emojis],
        deadlineAtMs: now + match.settings.guessingSeconds * 1000,
      },
    },
  };
}

function eligibleToGuess(match: EmojiLanguageMatchState, playerId: string): boolean {
  return (
    match.playerIds.includes(playerId) &&
    !match.departedPlayerIds.includes(playerId) &&
    match.round.writerPlayerId !== playerId
  );
}

export function submitEmojiLanguageGuess(
  match: EmojiLanguageMatchState,
  playerId: string,
  payload: { roundId: string; answer: string; requestId: string },
  now = Date.now(),
): GuessActionResult {
  const replay = match.round.processedGuesses.find(
    (entry) => entry.requestId === payload.requestId && entry.playerId === playerId,
  );
  if (replay) return { ok: true, changed: false, match, feedback: replay.feedback };
  if (
    match.round.phase !== 'guessing' ||
    match.round.roundId !== payload.roundId ||
    (match.round.deadlineAtMs !== null && now >= match.round.deadlineAtMs)
  ) {
    return { ok: false, message: 'التخمين غير متاح الآن.' };
  }
  if (!eligibleToGuess(match, playerId)) {
    return { ok: false, message: 'لا تملك صلاحية التخمين في هذه الجولة.' };
  }
  if (match.round.correctAnswerPlayerIds.includes(playerId)) {
    return { ok: false, message: 'تم اعتماد إجابتك الصحيحة لهذه الجولة.' };
  }
  if (
    typeof payload.requestId !== 'string' ||
    payload.requestId.length < 8 ||
    payload.requestId.length > 100 ||
    typeof payload.answer !== 'string' ||
    payload.answer.trim().length === 0 ||
    payload.answer.length > 100
  ) {
    return { ok: false, message: 'الإجابة غير صالحة.' };
  }
  const previousAt = match.round.lastAttemptAtMsByPlayerId[playerId];
  if (previousAt !== undefined && now - previousAt < EMOJI_LANGUAGE_GUESS_COOLDOWN_MS) {
    const cooldownMs = EMOJI_LANGUAGE_GUESS_COOLDOWN_MS - (now - previousAt);
    return { ok: false, message: 'تمهل قليلًا قبل المحاولة التالية.', cooldownMs };
  }

  const correct = isCorrectAnswer(payload.answer, match.round.acceptedAnswers);
  const correctAnswerPlayerIds = correct
    ? [...match.round.correctAnswerPlayerIds, playerId]
    : match.round.correctAnswerPlayerIds;
  const feedback: EmojiLanguageGuessFeedback = {
    correct,
    placement: correct ? correctAnswerPlayerIds.length : null,
    cooldownMs: EMOJI_LANGUAGE_GUESS_COOLDOWN_MS,
  };
  const round: EmojiLanguageRoundState = {
    ...match.round,
    correctAnswerPlayerIds,
    attemptCountByPlayerId: {
      ...match.round.attemptCountByPlayerId,
      [playerId]: (match.round.attemptCountByPlayerId[playerId] ?? 0) + 1,
    },
    lastAttemptAtMsByPlayerId: {
      ...match.round.lastAttemptAtMsByPlayerId,
      [playerId]: now,
    },
    processedGuesses: [
      ...match.round.processedGuesses,
      { requestId: payload.requestId, playerId, feedback },
    ].slice(-150),
  };
  return { ok: true, changed: true, match: { ...match, round }, feedback };
}

function finalizeRound(
  match: EmojiLanguageMatchState,
  reason: 'answered' | 'no-correct-answer' | 'no-clue' | 'insufficient-players',
  now: number,
): EmojiLanguageMatchState {
  if (match.round.scored) return match;
  const scores = { ...match.scores };
  match.round.correctAnswerPlayerIds.forEach((playerId, index) => {
    scores[playerId] = (scores[playerId] ?? 0) + pointsForPlacement(index + 1);
  });
  if (match.round.writerPlayerId && match.round.correctAnswerPlayerIds.length > 0) {
    scores[match.round.writerPlayerId] = (scores[match.round.writerPlayerId] ?? 0) + 100;
  }
  return {
    ...match,
    scores,
    round: {
      ...match.round,
      phase: 'round-results',
      deadlineAtMs: now + EMOJI_LANGUAGE_ROUND_RESULTS_MS,
      scored: true,
      resultReason: reason,
    },
  };
}

function completeMatch(
  match: EmojiLanguageMatchState,
  now: number,
  reason: EmojiLanguageRoundState['resultReason'] = match.round.resultReason,
): EmojiLanguageMatchState {
  return {
    ...match,
    round: {
      ...match.round,
      phase: 'completed',
      deadlineAtMs: now + EMOJI_LANGUAGE_MATCH_RESULTS_MS,
      resultReason: reason,
    },
  };
}

export function expireEmojiLanguagePhase(
  match: EmojiLanguageMatchState,
  expectedRoundId: string,
  expectedPhase: EmojiLanguageRoundState['phase'],
  now = Date.now(),
  random: () => number = Math.random,
): EmojiLanguageMatchState | null {
  if (
    match.round.roundId !== expectedRoundId ||
    match.round.phase !== expectedPhase ||
    match.round.deadlineAtMs === null ||
    now < match.round.deadlineAtMs
  ) {
    return null;
  }
  if (expectedPhase === 'preparation') return finalizeRound(match, 'no-clue', now);
  if (expectedPhase === 'guessing') {
    return finalizeRound(
      match,
      match.round.correctAnswerPlayerIds.length > 0 ? 'answered' : 'no-correct-answer',
      now,
    );
  }
  if (expectedPhase === 'round-results') {
    if (match.currentRound >= match.settings.roundCount) return completeMatch(match, now);
    const nextRoundNumber = match.currentRound + 1;
    const next = createRound({
      settings: match.settings,
      playerIds: match.writerRotationPlayerIds,
      departedPlayerIds: match.departedPlayerIds,
      roundNumber: nextRoundNumber,
      usedContentIds: match.usedContentIds,
      random,
      now,
    });
    if (!next.round.writerPlayerId && match.settings.mode === 'player-clue') {
      return completeMatch(match, now, 'insufficient-players');
    }
    return {
      ...match,
      currentRound: nextRoundNumber,
      usedContentIds: next.usedContentIds,
      round: next.round,
    };
  }
  return match;
}

export function handleEmojiLanguagePermanentLeave(
  match: EmojiLanguageMatchState,
  playerId: string,
  now = Date.now(),
): EmojiLanguageMatchState {
  if (!match.playerIds.includes(playerId) || match.departedPlayerIds.includes(playerId))
    return match;
  const departedPlayerIds = [...match.departedPlayerIds, playerId];
  const playerIds = match.playerIds.filter((id) => id !== playerId);
  const activeCount = playerIds.length;
  const next = { ...match, playerIds, departedPlayerIds };
  if (match.round.phase === 'completed') return next;
  if (activeCount < 2) return completeMatch(next, now, 'insufficient-players');
  if (
    match.round.phase === 'preparation' &&
    match.round.writerPlayerId === playerId &&
    !match.round.clue
  ) {
    return finalizeRound(next, 'no-clue', now);
  }
  return next;
}

function placementFor(match: EmojiLanguageMatchState, playerId: string): number | null {
  const index = match.round.correctAnswerPlayerIds.indexOf(playerId);
  return index === -1 ? null : index + 1;
}

function roundPointsFor(match: EmojiLanguageMatchState, playerId: string): number {
  const placement = placementFor(match, playerId);
  const guessPoints = placement === null ? 0 : pointsForPlacement(placement);
  const writerPoints =
    match.round.writerPlayerId === playerId && match.round.correctAnswerPlayerIds.length > 0
      ? 100
      : 0;
  return guessPoints + writerPoints;
}

function buildRoundResults(match: EmojiLanguageMatchState): EmojiLanguageRoundResultEntry[] {
  return match.playerIds.map((playerId) => ({
    playerId,
    name: match.playerNames[playerId] ?? 'لاعب',
    placement: placementFor(match, playerId),
    roundPoints: roundPointsFor(match, playerId),
    totalPoints: match.scores[playerId] ?? 0,
    isWriter: match.round.writerPlayerId === playerId,
  }));
}

function buildLeaderboard(match: EmojiLanguageMatchState): EmojiLanguageLeaderboardEntry[] {
  const order = new Map(match.playerIds.map((playerId, index) => [playerId, index]));
  return match.playerIds
    .map((playerId) => ({
      playerId,
      name: match.playerNames[playerId] ?? 'لاعب',
      score: match.scores[playerId] ?? 0,
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        (order.get(left.playerId) ?? 0) - (order.get(right.playerId) ?? 0),
    );
}

export function buildEmojiLanguagePlayerView(
  match: EmojiLanguageMatchState,
  playerId: string,
  shell: GameShellState,
  now = Date.now(),
): EmojiLanguagePlayerView {
  const isParticipant =
    (shell.matchParticipantIds ?? match.playerIds).includes(playerId) &&
    match.playerIds.includes(playerId) &&
    !match.departedPlayerIds.includes(playerId);
  const isWriter = match.round.writerPlayerId === playerId;
  const revealed = match.round.phase === 'round-results' || match.round.phase === 'completed';
  const ownPlacement = placementFor(match, playerId);
  return {
    gameId: EMOJI_LANGUAGE_GAME_ID,
    selfPlayerId: playerId,
    mode: match.settings.mode,
    settings: { ...match.settings },
    phase: match.round.phase,
    currentRound: match.currentRound,
    totalRounds: match.settings.roundCount,
    roundId: match.round.roundId,
    writerPlayerId: match.round.writerPlayerId,
    writerName: match.round.writerPlayerId
      ? (match.playerNames[match.round.writerPlayerId] ?? 'لاعب')
      : null,
    isWriter,
    isSpectator: !isParticipant,
    canSubmitClue: isParticipant && isWriter && match.round.phase === 'preparation',
    canGuess:
      isParticipant && !isWriter && match.round.phase === 'guessing' && ownPlacement === null,
    privateAnswer: isWriter && !revealed ? match.round.answer : null,
    revealedAnswer: revealed ? match.round.answer : null,
    clue:
      match.round.phase === 'guessing' || revealed
        ? match.round.clue
          ? [...match.round.clue]
          : null
        : null,
    deadlineAtMs: match.round.deadlineAtMs,
    remainingSeconds:
      match.round.deadlineAtMs === null
        ? null
        : Math.max(0, Math.ceil((match.round.deadlineAtMs - now) / 1000)),
    ownAttemptCount: match.round.attemptCountByPlayerId[playerId] ?? 0,
    ownCorrect: ownPlacement !== null,
    ownPlacement,
    correctAnswerCount: match.round.correctAnswerPlayerIds.length,
    roundResults: revealed ? buildRoundResults(match) : [],
    leaderboard: buildLeaderboard(match),
    resultReason: revealed ? match.round.resultReason : null,
  };
}
