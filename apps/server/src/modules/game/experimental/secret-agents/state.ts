import { randomUUID } from 'node:crypto';
import type {
  GameShellState,
  SecretAgentsAssignment,
  SecretAgentsCardActionPayload,
  SecretAgentsCardType,
  SecretAgentsClue,
  SecretAgentsClueValue,
  SecretAgentsLogEntry,
  SecretAgentsPlayerView,
  SecretAgentsRole,
  SecretAgentsSettings,
  SecretAgentsTeam,
} from '@wanasatna/shared';
import {
  SECRET_AGENTS_BOARD_SIZE,
  SECRET_AGENTS_DEFAULT_SETTINGS,
  SECRET_AGENTS_MAX_PLAYERS,
} from '@wanasatna/shared';
import {
  normalizeSecretAgentsArabic,
  SECRET_AGENTS_PROVISIONAL_WORDS,
} from './provisional-words.js';

export type SecretAgentsSecretCard = {
  id: string;
  position: number;
  word: string;
  type: SecretAgentsCardType;
  revealed: boolean;
};

export type SecretAgentsMatchState = {
  matchId: string;
  playerIds: string[];
  playerNames: Record<string, string>;
  assignments: Record<string, SecretAgentsAssignment>;
  cards: SecretAgentsSecretCard[];
  settings: SecretAgentsSettings;
  startingTeam: SecretAgentsTeam;
  activeTeam: SecretAgentsTeam;
  phase: 'clue' | 'guessing' | 'paused' | 'completed';
  pausedFromPhase: 'clue' | 'guessing' | null;
  pauseReason: 'missing-spymaster' | 'missing-operative' | null;
  recoveryDeadlineAtMs: number | null;
  pausedRemainingMs: number | null;
  turnNumber: number;
  turnId: string;
  clue: SecretAgentsClue | null;
  confirmedGuesses: number;
  maxConfirmedGuesses: number | null;
  nominationsByCardId: Record<string, string[]>;
  deadlineAtMs: number | null;
  winnerTeam: SecretAgentsTeam | null;
  resultReason: 'agents-found' | 'assassin' | 'opponent-agent' | 'recovery-expired' | null;
  log: SecretAgentsLogEntry[];
  processedRequestIds: string[];
};

type ActionResult =
  { ok: true; match: SecretAgentsMatchState; changed: boolean } | { ok: false; message: string };

export function otherSecretAgentsTeam(team: SecretAgentsTeam): SecretAgentsTeam {
  return team === 'red' ? 'blue' : 'red';
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [next[index], next[target]] = [next[target]!, next[index]!];
  }
  return next;
}

export function createSecretAgentsBoard(
  random: () => number = Math.random,
  words: readonly string[] = SECRET_AGENTS_PROVISIONAL_WORDS,
): { startingTeam: SecretAgentsTeam; cards: SecretAgentsSecretCard[] } {
  if (words.length < SECRET_AGENTS_BOARD_SIZE) {
    throw new Error('Secret Agents needs at least 25 provisional words.');
  }

  const selectedWords = shuffle(words, random).slice(0, SECRET_AGENTS_BOARD_SIZE);
  if (new Set(selectedWords.map(normalizeSecretAgentsArabic)).size !== SECRET_AGENTS_BOARD_SIZE) {
    throw new Error('Secret Agents board words must be distinct.');
  }

  const startingTeam: SecretAgentsTeam = random() < 0.5 ? 'red' : 'blue';
  const otherTeam = otherSecretAgentsTeam(startingTeam);
  const types = shuffle<SecretAgentsCardType>(
    [
      ...Array.from({ length: 9 }, () => startingTeam),
      ...Array.from({ length: 8 }, () => otherTeam),
      ...Array.from({ length: 7 }, () => 'neutral' as const),
      'assassin',
    ],
    random,
  );

  return {
    startingTeam,
    cards: selectedWords.map((word, position) => ({
      id: randomUUID(),
      position,
      word,
      type: types[position]!,
      revealed: false,
    })),
  };
}

function phaseDeadline(
  phase: 'clue' | 'guessing',
  settings: SecretAgentsSettings,
  now: number,
): number | null {
  if (phase === 'clue') {
    return settings.clueTimerEnabled ? now + settings.clueSeconds * 1000 : null;
  }
  return settings.operativeTimerEnabled ? now + settings.operativeSeconds * 1000 : null;
}

function turnLog(team: SecretAgentsTeam, turnNumber: number): SecretAgentsLogEntry {
  return {
    id: randomUUID(),
    turnNumber,
    team,
    kind: 'turn',
    text: `بدأ دور الفريق ${team === 'red' ? 'الأحمر' : 'الأزرق'}.`,
  };
}

export function createSecretAgentsMatch(input: {
  assignments: Record<string, SecretAgentsAssignment>;
  playerNames: Record<string, string>;
  settings?: SecretAgentsSettings;
  random?: () => number;
  now?: number;
}): SecretAgentsMatchState {
  const settings = { ...SECRET_AGENTS_DEFAULT_SETTINGS, ...input.settings };
  const { cards, startingTeam } = createSecretAgentsBoard(input.random);
  const now = input.now ?? Date.now();
  const playerIds = Object.keys(input.assignments);

  return {
    matchId: randomUUID(),
    playerIds,
    playerNames: { ...input.playerNames },
    assignments: Object.fromEntries(
      Object.entries(input.assignments).map(([playerId, assignment]) => [
        playerId,
        { ...assignment, locked: true },
      ]),
    ),
    cards,
    settings,
    startingTeam,
    activeTeam: startingTeam,
    phase: 'clue',
    pausedFromPhase: null,
    pauseReason: null,
    recoveryDeadlineAtMs: null,
    pausedRemainingMs: null,
    turnNumber: 1,
    turnId: randomUUID(),
    clue: null,
    confirmedGuesses: 0,
    maxConfirmedGuesses: null,
    nominationsByCardId: {},
    deadlineAtMs: phaseDeadline('clue', settings, now),
    winnerTeam: null,
    resultReason: null,
    log: [turnLog(startingTeam, 1)],
    processedRequestIds: [],
  };
}

export function countSecretAgentsByType(
  match: SecretAgentsMatchState,
  type: SecretAgentsCardType,
  revealed?: boolean,
): number {
  return match.cards.filter(
    (card) => card.type === type && (revealed === undefined || card.revealed === revealed),
  ).length;
}

function hasProcessed(match: SecretAgentsMatchState, requestId: string): boolean {
  return match.processedRequestIds.includes(requestId);
}

function withProcessed(match: SecretAgentsMatchState, requestId: string): SecretAgentsMatchState {
  return {
    ...match,
    processedRequestIds: [...match.processedRequestIds, requestId].slice(-100),
  };
}

function validRequestId(requestId: unknown): requestId is string {
  return typeof requestId === 'string' && requestId.length >= 8 && requestId.length <= 100;
}

function appendLog(
  match: SecretAgentsMatchState,
  entry: Omit<SecretAgentsLogEntry, 'id' | 'turnNumber' | 'team'>,
): SecretAgentsMatchState {
  return {
    ...match,
    log: [
      ...match.log,
      {
        ...entry,
        id: randomUUID(),
        turnNumber: match.turnNumber,
        team: match.activeTeam,
      },
    ],
  };
}

function completeMatch(
  match: SecretAgentsMatchState,
  winnerTeam: SecretAgentsTeam | null,
  resultReason: SecretAgentsMatchState['resultReason'],
  text: string,
): SecretAgentsMatchState {
  const logged = appendLog(match, { kind: 'result', text });
  return {
    ...logged,
    phase: 'completed',
    winnerTeam,
    resultReason,
    deadlineAtMs: null,
    recoveryDeadlineAtMs: null,
    pausedFromPhase: null,
    pauseReason: null,
    pausedRemainingMs: null,
    nominationsByCardId: {},
  };
}

export function startNextSecretAgentsTurn(
  match: SecretAgentsMatchState,
  reasonText: string,
  kind: 'pass' | 'timeout' | 'guess' = 'pass',
  now = Date.now(),
): SecretAgentsMatchState {
  const ended = appendLog(match, { kind, text: reasonText });
  const activeTeam = otherSecretAgentsTeam(match.activeTeam);
  const turnNumber = match.turnNumber + 1;
  const next: SecretAgentsMatchState = {
    ...ended,
    activeTeam,
    phase: 'clue',
    pausedFromPhase: null,
    pauseReason: null,
    recoveryDeadlineAtMs: null,
    pausedRemainingMs: null,
    turnNumber,
    turnId: randomUUID(),
    clue: null,
    confirmedGuesses: 0,
    maxConfirmedGuesses: null,
    nominationsByCardId: {},
    deadlineAtMs: phaseDeadline('clue', match.settings, now),
  };
  return { ...next, log: [...next.log, turnLog(activeTeam, turnNumber)] };
}

function eligibleAssignment(
  match: SecretAgentsMatchState,
  playerId: string,
  team: SecretAgentsTeam,
  role: SecretAgentsRole,
): boolean {
  const assignment = match.assignments[playerId];
  return assignment?.team === team && assignment.role === role;
}

export function addSecretAgentsMidMatchPlayer(
  match: SecretAgentsMatchState,
  input: { playerId: string; playerName: string; team: SecretAgentsTeam; role: SecretAgentsRole },
): ActionResult {
  if (match.phase === 'completed') {
    return { ok: false, message: 'انتهت المباراة.' };
  }
  if (match.assignments[input.playerId]) {
    return { ok: false, message: 'تم تثبيت فريقك ودورك لهذه المباراة.' };
  }
  if (match.playerIds.length >= SECRET_AGENTS_MAX_PLAYERS) {
    return { ok: false, message: 'اكتمل الحد الأقصى لمشاركي المباراة.' };
  }

  return {
    ok: true,
    changed: true,
    match: {
      ...match,
      playerIds: [...match.playerIds, input.playerId],
      playerNames: { ...match.playerNames, [input.playerId]: input.playerName },
      assignments: {
        ...match.assignments,
        [input.playerId]: { team: input.team, role: input.role, locked: true },
      },
    },
  };
}

function normalizeClueWord(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > 32 || trimmed.includes(' ')) return null;
  return trimmed;
}

function normalizeClueValue(value: unknown): SecretAgentsClueValue | null {
  if (value === 'unlimited') return value;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 25) {
    return null;
  }
  return value;
}

export function submitSecretAgentsClue(
  match: SecretAgentsMatchState,
  playerId: string,
  payload: { turnId?: unknown; word?: unknown; value?: unknown },
  now = Date.now(),
): ActionResult {
  if (match.phase !== 'clue' || payload.turnId !== match.turnId || match.clue) {
    return { ok: false, message: 'انتهت مرحلة التلميح لهذا الدور.' };
  }
  if (!eligibleAssignment(match, playerId, match.activeTeam, 'spymaster')) {
    return { ok: false, message: 'التلميح متاح لقائد الفريق النشط فقط.' };
  }
  if (match.deadlineAtMs !== null && now >= match.deadlineAtMs) {
    return { ok: false, message: 'انتهى وقت التلميح.' };
  }

  const word = normalizeClueWord(payload.word);
  const value = normalizeClueValue(payload.value);
  if (!word || value === null) {
    return { ok: false, message: 'أدخل كلمة تلميح واحدة وقيمة صحيحة.' };
  }
  const normalizedWord = normalizeSecretAgentsArabic(word);
  if (
    match.cards.some(
      (card) => !card.revealed && normalizeSecretAgentsArabic(card.word) === normalizedWord,
    )
  ) {
    return { ok: false, message: 'لا يمكن أن يطابق التلميح كلمة ظاهرة على اللوح.' };
  }

  const clue: SecretAgentsClue = {
    word,
    value,
    spymasterPlayerId: playerId,
    spymasterName: match.playerNames[playerId] ?? 'قائد',
  };
  const logged = appendLog(match, {
    kind: 'clue',
    text: `قدّم ${clue.spymasterName} التلميح «${word}» (${value === 'unlimited' ? '∞' : value}).`,
  });
  return {
    ok: true,
    changed: true,
    match: {
      ...logged,
      clue,
      phase: 'guessing',
      confirmedGuesses: 0,
      maxConfirmedGuesses: typeof value === 'number' && value > 0 ? value + 1 : null,
      deadlineAtMs: phaseDeadline('guessing', match.settings, now),
    },
  };
}

export function toggleSecretAgentsNomination(
  match: SecretAgentsMatchState,
  playerId: string,
  payload: SecretAgentsCardActionPayload,
  now = Date.now(),
): ActionResult {
  if (!validRequestId(payload.requestId)) {
    return { ok: false, message: 'طلب الترشيح غير صالح.' };
  }
  if (hasProcessed(match, payload.requestId)) {
    return { ok: true, changed: false, match };
  }
  if (match.phase !== 'guessing' || payload.turnId !== match.turnId) {
    return { ok: false, message: 'الترشيح غير متاح الآن.' };
  }
  if (!eligibleAssignment(match, playerId, match.activeTeam, 'operative')) {
    return { ok: false, message: 'الترشيح متاح لمخمّني الفريق النشط فقط.' };
  }
  if (match.deadlineAtMs !== null && now >= match.deadlineAtMs) {
    return { ok: false, message: 'انتهى وقت التخمين.' };
  }
  const card = match.cards.find((candidate) => candidate.id === payload.cardId);
  if (!card || card.revealed) {
    return { ok: false, message: 'هذه البطاقة غير متاحة.' };
  }

  const current = match.nominationsByCardId[card.id] ?? [];
  const nominations = current.includes(playerId)
    ? current.filter((candidate) => candidate !== playerId)
    : [...current, playerId];
  const nominationsByCardId = { ...match.nominationsByCardId };
  if (nominations.length === 0) delete nominationsByCardId[card.id];
  else nominationsByCardId[card.id] = nominations;

  return {
    ok: true,
    changed: true,
    match: withProcessed({ ...match, nominationsByCardId }, payload.requestId),
  };
}

export function confirmSecretAgentsCard(
  match: SecretAgentsMatchState,
  playerId: string,
  payload: SecretAgentsCardActionPayload,
  now = Date.now(),
): ActionResult {
  if (!validRequestId(payload.requestId)) {
    return { ok: false, message: 'طلب التأكيد غير صالح.' };
  }
  if (hasProcessed(match, payload.requestId)) {
    return { ok: true, changed: false, match };
  }
  if (match.phase !== 'guessing' || payload.turnId !== match.turnId) {
    return { ok: false, message: 'انتهت مرحلة التخمين لهذا الدور.' };
  }
  if (!eligibleAssignment(match, playerId, match.activeTeam, 'operative')) {
    return { ok: false, message: 'التأكيد متاح لمخمّني الفريق النشط فقط.' };
  }
  if (match.deadlineAtMs !== null && now >= match.deadlineAtMs) {
    return { ok: false, message: 'انتهى وقت التخمين.' };
  }
  const cardIndex = match.cards.findIndex((candidate) => candidate.id === payload.cardId);
  const card = match.cards[cardIndex];
  if (!card || card.revealed) {
    return { ok: false, message: 'هذه البطاقة كُشفت من قبل.' };
  }

  const cards = match.cards.map((candidate, index) =>
    index === cardIndex ? { ...candidate, revealed: true } : candidate,
  );
  let next = withProcessed(
    { ...match, cards, confirmedGuesses: match.confirmedGuesses + 1 },
    payload.requestId,
  );
  const confirmerName = match.playerNames[playerId] ?? 'مخمّن';
  next = appendLog(next, {
    kind: 'guess',
    text: `ثبّت ${confirmerName} بطاقة «${card.word}».`,
    cardWord: card.word,
    revealedType: card.type,
  });

  if (card.type === 'assassin') {
    const winner = otherSecretAgentsTeam(match.activeTeam);
    return {
      ok: true,
      changed: true,
      match: completeMatch(next, winner, 'assassin', 'كُشف القاتل؛ انتهت المباراة فورًا.'),
    };
  }

  if (card.type === 'red' || card.type === 'blue') {
    const remaining = countSecretAgentsByType(next, card.type, false);
    if (remaining === 0) {
      const reason = card.type === match.activeTeam ? 'agents-found' : 'opponent-agent';
      return {
        ok: true,
        changed: true,
        match: completeMatch(
          next,
          card.type,
          reason,
          `اكتملت بطاقات الفريق ${card.type === 'red' ? 'الأحمر' : 'الأزرق'}.`,
        ),
      };
    }
  }

  if (card.type !== match.activeTeam) {
    return {
      ok: true,
      changed: true,
      match: startNextSecretAgentsTurn(next, 'أنهى التخمين الخاطئ الدور.', 'guess', now),
    };
  }

  if (next.deadlineAtMs !== null) {
    const remainingMs = Math.max(0, next.deadlineAtMs - now);
    const bonusMs = next.settings.correctGuessBonusSeconds * 1000;
    next = {
      ...next,
      deadlineAtMs: now + Math.min(next.settings.operativeSeconds * 1000, remainingMs + bonusMs),
    };
  }

  if (next.maxConfirmedGuesses !== null && next.confirmedGuesses >= next.maxConfirmedGuesses) {
    next = startNextSecretAgentsTurn(next, 'اكتمل الحد المسموح للتخمينات.', 'guess', now);
  }
  return { ok: true, changed: true, match: next };
}

export function passSecretAgentsTurn(
  match: SecretAgentsMatchState,
  playerId: string,
  payload: { turnId?: unknown; requestId?: unknown },
  now = Date.now(),
): ActionResult {
  if (!validRequestId(payload.requestId)) {
    return { ok: false, message: 'طلب إنهاء الدور غير صالح.' };
  }
  if (hasProcessed(match, payload.requestId)) {
    return { ok: true, changed: false, match };
  }
  if (match.phase !== 'guessing' || payload.turnId !== match.turnId) {
    return { ok: false, message: 'لا يمكن إنهاء هذا الدور الآن.' };
  }
  if (!eligibleAssignment(match, playerId, match.activeTeam, 'operative')) {
    return { ok: false, message: 'إنهاء الدور متاح لمخمّني الفريق النشط فقط.' };
  }
  const processed = withProcessed(match, payload.requestId);
  return {
    ok: true,
    changed: true,
    match: startNextSecretAgentsTurn(processed, 'أنهى الفريق دوره طوعًا.', 'pass', now),
  };
}

export function expireSecretAgentsPhase(
  match: SecretAgentsMatchState,
  expectedTurnId: string,
  expectedPhase: 'clue' | 'guessing',
  now = Date.now(),
): SecretAgentsMatchState | null {
  if (
    match.turnId !== expectedTurnId ||
    match.phase !== expectedPhase ||
    match.deadlineAtMs === null ||
    now < match.deadlineAtMs
  ) {
    return null;
  }
  const text = expectedPhase === 'clue' ? 'انتهى وقت القائد دون تلميح.' : 'انتهى وقت المخمّنين.';
  return startNextSecretAgentsTurn(match, text, 'timeout', now);
}

export function pauseSecretAgentsMatch(
  match: SecretAgentsMatchState,
  reason: 'missing-spymaster' | 'missing-operative',
  recoveryDeadlineAtMs: number,
  now = Date.now(),
): SecretAgentsMatchState {
  if (match.phase === 'paused' || match.phase === 'completed') return match;
  return {
    ...match,
    pausedFromPhase: match.phase,
    phase: 'paused',
    pauseReason: reason,
    recoveryDeadlineAtMs,
    pausedRemainingMs: match.deadlineAtMs === null ? null : Math.max(0, match.deadlineAtMs - now),
    deadlineAtMs: null,
  };
}

export function resumeSecretAgentsMatch(
  match: SecretAgentsMatchState,
  now = Date.now(),
): SecretAgentsMatchState {
  if (match.phase !== 'paused' || !match.pausedFromPhase) return match;
  return {
    ...match,
    phase: match.pausedFromPhase,
    pausedFromPhase: null,
    pauseReason: null,
    recoveryDeadlineAtMs: null,
    deadlineAtMs:
      match.pausedRemainingMs === null ? null : now + Math.max(0, match.pausedRemainingMs),
    pausedRemainingMs: null,
  };
}

export function expireSecretAgentsRecovery(match: SecretAgentsMatchState): SecretAgentsMatchState {
  return completeMatch(
    match,
    null,
    'recovery-expired',
    'انتهت مهلة العودة؛ انتهت المباراة بلا فائز.',
  );
}

export function buildSecretAgentsPlayerView(
  match: SecretAgentsMatchState,
  playerId: string,
  shell: GameShellState,
  now = Date.now(),
): SecretAgentsPlayerView {
  const selfAssignment = match.assignments[playerId] ?? null;
  const ownTeam = selfAssignment?.team ?? null;
  const isActiveOperative =
    match.phase === 'guessing' &&
    selfAssignment?.team === match.activeTeam &&
    selfAssignment.role === 'operative';
  const isActiveSpymaster =
    match.phase === 'clue' &&
    selfAssignment?.team === match.activeTeam &&
    selfAssignment.role === 'spymaster';

  return {
    gameId: 'secret-agents',
    selfPlayerId: playerId,
    phase: match.phase,
    activeTeam: match.activeTeam,
    startingTeam: match.startingTeam,
    turnNumber: match.turnNumber,
    turnId: match.turnId,
    settings: match.settings,
    roster: shell.players.map((player) => ({
      playerId: player.id,
      name: player.name,
      isConnected: player.isConnected,
      assignment: match.assignments[player.id] ?? null,
    })),
    selfAssignment,
    canAssignMidMatch:
      match.phase !== 'completed' &&
      !selfAssignment &&
      match.playerIds.length < SECRET_AGENTS_MAX_PLAYERS,
    canSubmitClue: isActiveSpymaster,
    canNominate: isActiveOperative,
    canConfirm: isActiveOperative,
    canPass: isActiveOperative,
    clue: match.clue,
    confirmedGuesses: match.confirmedGuesses,
    maxConfirmedGuesses: match.maxConfirmedGuesses,
    remainingByTeam: {
      red: countSecretAgentsByType(match, 'red', false),
      blue: countSecretAgentsByType(match, 'blue', false),
    },
    cards: match.cards.map((card) => ({
      id: card.id,
      position: card.position,
      word: card.word,
      revealed: card.revealed,
      revealedType: card.revealed ? card.type : null,
      nominations:
        ownTeam && match.phase === 'guessing'
          ? (match.nominationsByCardId[card.id] ?? [])
              .filter((candidate) => match.assignments[candidate]?.team === ownTeam)
              .map((candidate) => ({
                playerId: candidate,
                name: match.playerNames[candidate] ?? 'لاعب',
              }))
          : [],
    })),
    secretKey:
      selfAssignment?.role === 'spymaster'
        ? Object.fromEntries(match.cards.map((card) => [card.id, card.type]))
        : null,
    deadlineAtMs: match.deadlineAtMs,
    remainingSeconds:
      match.deadlineAtMs === null
        ? null
        : Math.max(0, Math.ceil((match.deadlineAtMs - now) / 1000)),
    pausedFromPhase: match.pausedFromPhase,
    pauseReason: match.pauseReason,
    recoveryDeadlineAtMs: match.recoveryDeadlineAtMs,
    winnerTeam: match.winnerTeam,
    resultReason: match.resultReason,
    log: match.log,
  };
}
