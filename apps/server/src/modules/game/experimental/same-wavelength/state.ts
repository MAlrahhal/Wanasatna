import { randomUUID } from 'node:crypto';
import type {
  GameShellState,
  SameWavelengthAssignment,
  SameWavelengthLeaderboardEntry,
  SameWavelengthPlayerView,
  SameWavelengthProposalView,
  SameWavelengthResultEntry,
  SameWavelengthSettings,
  SameWavelengthTeam,
  SameWavelengthTeamSummary,
} from '@wanasatna/shared';
import { SAME_WAVELENGTH_GAME_ID } from '@wanasatna/shared';
import {
  SAME_WAVELENGTH_PROVISIONAL_SPECTRA,
  type SameWavelengthSpectrum,
} from './provisional-content.js';

export const SAME_WAVELENGTH_TURN_RESULTS_MS = 10_000;
export const SAME_WAVELENGTH_MATCH_RESULTS_MS = 12_000;
const MAX_PROCESSED_REQUESTS = 200;

type Proposal = { position: number; confirmed: boolean };

export type SameWavelengthTurnState = {
  turnId: string;
  spectrumId: string;
  leftLabel: string;
  rightLabel: string;
  target: number;
  clueGiverPlayerId: string | null;
  activeTeam: SameWavelengthTeam | null;
  teamTurnNumber: 1 | 2 | null;
  phase: 'clue-writing' | 'guessing' | 'turn-results' | 'completed';
  clue: string | null;
  deadlineAtMs: number | null;
  proposals: Record<string, Proposal>;
  agreedGuess: number | null;
  scored: boolean;
  resultReason: 'scored' | 'no-clue' | 'no-consensus' | 'interrupted' | null;
};

export type SameWavelengthMatchState = {
  matchId: string;
  playerIds: string[];
  playerNames: Record<string, string>;
  departedPlayerIds: string[];
  settings: SameWavelengthSettings;
  assignments: Record<string, SameWavelengthAssignment>;
  clueRotationPlayerIds: string[];
  currentRound: number;
  scores: Record<string, number>;
  teamScores: Record<SameWavelengthTeam, number>;
  usedSpectrumIds: string[];
  processedRequestIds: string[];
  completedNormally: boolean | null;
  turn: SameWavelengthTurnState;
};

type ActionResult =
  { ok: true; match: SameWavelengthMatchState; changed: boolean } | { ok: false; message: string };

function shuffled(values: readonly string[], random: () => number): string[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}

function chooseSpectrum(
  usedSpectrumIds: readonly string[],
  random: () => number,
): { spectrum: SameWavelengthSpectrum; usedSpectrumIds: string[] } {
  const unused = SAME_WAVELENGTH_PROVISIONAL_SPECTRA.filter(
    (entry) => !usedSpectrumIds.includes(entry.id),
  );
  const pool = unused.length > 0 ? unused : SAME_WAVELENGTH_PROVISIONAL_SPECTRA;
  const spectrum = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!;
  return {
    spectrum,
    usedSpectrumIds: unused.length > 0 ? [...usedSpectrumIds, spectrum.id] : [spectrum.id],
  };
}

function currentIndividualClueGiver(match: {
  clueRotationPlayerIds: readonly string[];
  departedPlayerIds: readonly string[];
  currentRound: number;
}): string | null {
  const departed = new Set(match.departedPlayerIds);
  for (let offset = 0; offset < match.clueRotationPlayerIds.length; offset += 1) {
    const index = (match.currentRound - 1 + offset) % match.clueRotationPlayerIds.length;
    const playerId = match.clueRotationPlayerIds[index];
    if (playerId && !departed.has(playerId)) return playerId;
  }
  return null;
}

function createTurn(input: {
  settings: SameWavelengthSettings;
  currentRound: number;
  activeTeam: SameWavelengthTeam | null;
  assignments: Record<string, SameWavelengthAssignment>;
  clueRotationPlayerIds: readonly string[];
  departedPlayerIds: readonly string[];
  usedSpectrumIds: readonly string[];
  random: () => number;
  now: number;
}): { turn: SameWavelengthTurnState; usedSpectrumIds: string[] } {
  const selected = chooseSpectrum(input.usedSpectrumIds, input.random);
  const clueGiverPlayerId =
    input.settings.mode === 'team'
      ? (Object.entries(input.assignments).find(
          ([playerId, assignment]) =>
            assignment.team === input.activeTeam &&
            assignment.role === 'clue-giver' &&
            !input.departedPlayerIds.includes(playerId),
        )?.[0] ?? null)
      : currentIndividualClueGiver(input);
  return {
    usedSpectrumIds: selected.usedSpectrumIds,
    turn: {
      turnId: randomUUID(),
      spectrumId: selected.spectrum.id,
      leftLabel: selected.spectrum.leftLabel,
      rightLabel: selected.spectrum.rightLabel,
      target: Math.min(100, Math.floor(input.random() * 101)),
      clueGiverPlayerId,
      activeTeam: input.activeTeam,
      teamTurnNumber: input.settings.mode === 'team' ? (input.activeTeam === 'red' ? 1 : 2) : null,
      phase: 'clue-writing',
      clue: null,
      deadlineAtMs: input.now + input.settings.clueSeconds * 1000,
      proposals: {},
      agreedGuess: null,
      scored: false,
      resultReason: null,
    },
  };
}

export function createSameWavelengthMatch(input: {
  playerIds: readonly string[];
  playerNames: Record<string, string>;
  settings: SameWavelengthSettings;
  assignments?: Record<string, SameWavelengthAssignment>;
  random?: () => number;
  now?: number;
}): SameWavelengthMatchState {
  const random = input.random ?? Math.random;
  const now = input.now ?? Date.now();
  const playerIds = [...new Set(input.playerIds)];
  const clueRotationPlayerIds = shuffled(playerIds, random);
  const first = createTurn({
    settings: input.settings,
    currentRound: 1,
    activeTeam: input.settings.mode === 'team' ? 'red' : null,
    assignments: input.assignments ?? {},
    clueRotationPlayerIds,
    departedPlayerIds: [],
    usedSpectrumIds: [],
    random,
    now,
  });
  return {
    matchId: randomUUID(),
    playerIds,
    playerNames: { ...input.playerNames },
    departedPlayerIds: [],
    settings: { ...input.settings },
    assignments: { ...(input.assignments ?? {}) },
    clueRotationPlayerIds,
    currentRound: 1,
    scores: Object.fromEntries(playerIds.map((playerId) => [playerId, 0])),
    teamScores: { red: 0, blue: 0 },
    usedSpectrumIds: first.usedSpectrumIds,
    processedRequestIds: [],
    completedNormally: null,
    turn: first.turn,
  };
}

export function sameWavelengthPoints(target: number, guess: number | null): number {
  if (guess === null) return 0;
  const closeness = 100 - Math.abs(guess - target);
  if (closeness === 100) return 5;
  if (closeness >= 75) return 4;
  if (closeness >= 50) return 3;
  if (closeness >= 25) return 2;
  if (closeness >= 1) return 1;
  return 0;
}

function validPosition(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 100;
}

function acceptRequest(
  match: SameWavelengthMatchState,
  requestId: string,
): SameWavelengthMatchState {
  return {
    ...match,
    processedRequestIds: [...match.processedRequestIds, requestId].slice(-MAX_PROCESSED_REQUESTS),
  };
}

function validateRequest(match: SameWavelengthMatchState, requestId: unknown): string | null {
  if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 100) {
    return 'معرّف الطلب غير صالح.';
  }
  return match.processedRequestIds.includes(requestId) ? 'تم تنفيذ هذا الطلب مسبقًا.' : null;
}

function activePlayerIds(match: SameWavelengthMatchState): string[] {
  return match.playerIds.filter((id) => !match.departedPlayerIds.includes(id));
}

function eligibleGuesserIds(match: SameWavelengthMatchState): string[] {
  const active = activePlayerIds(match);
  if (match.settings.mode === 'individual') {
    return active.filter((id) => id !== match.turn.clueGiverPlayerId);
  }
  return active.filter((id) => {
    const assignment = match.assignments[id];
    return assignment?.team === match.turn.activeTeam && assignment.role === 'guesser';
  });
}

function finalizeTurn(
  match: SameWavelengthMatchState,
  reason: 'scored' | 'no-clue' | 'no-consensus',
  now: number,
): SameWavelengthMatchState {
  if (
    match.turn.scored ||
    match.turn.phase === 'turn-results' ||
    match.turn.phase === 'completed'
  ) {
    return match;
  }
  const scores = { ...match.scores };
  const teamScores = { ...match.teamScores };
  let agreedGuess: number | null = null;
  if (reason === 'scored' && match.settings.mode === 'team' && match.turn.activeTeam) {
    const guessers = eligibleGuesserIds(match);
    const positions = guessers.map((id) => match.turn.proposals[id]?.position ?? null);
    const unanimous =
      guessers.length > 0 &&
      positions.every((position) => position !== null && position === positions[0]) &&
      guessers.every((id) => match.turn.proposals[id]?.confirmed === true);
    if (unanimous) {
      agreedGuess = positions[0];
      teamScores[match.turn.activeTeam] += sameWavelengthPoints(match.turn.target, agreedGuess);
    }
  } else if (reason === 'scored' && match.settings.mode === 'individual') {
    for (const playerId of eligibleGuesserIds(match)) {
      const proposal = match.turn.proposals[playerId];
      if (proposal) {
        scores[playerId] =
          (scores[playerId] ?? 0) + sameWavelengthPoints(match.turn.target, proposal.position);
      }
    }
  }
  return {
    ...match,
    scores,
    teamScores,
    turn: {
      ...match.turn,
      phase: 'turn-results',
      deadlineAtMs: now + SAME_WAVELENGTH_TURN_RESULTS_MS,
      agreedGuess,
      scored: true,
      resultReason: reason,
    },
  };
}

export function submitSameWavelengthClue(
  match: SameWavelengthMatchState,
  playerId: string,
  payload: { turnId: string; clue: unknown; requestId: string },
  now = Date.now(),
): ActionResult {
  const requestError = validateRequest(match, payload.requestId);
  if (requestError) return { ok: false, message: requestError };
  if (
    match.turn.turnId !== payload.turnId ||
    match.turn.phase !== 'clue-writing' ||
    (match.turn.deadlineAtMs !== null && now >= match.turn.deadlineAtMs)
  ) {
    return { ok: false, message: 'انتهت مرحلة كتابة التلميح.' };
  }
  if (match.turn.clueGiverPlayerId !== playerId) {
    return { ok: false, message: 'إرسال التلميح متاح للملمّح الحالي فقط.' };
  }
  if (typeof payload.clue !== 'string') return { ok: false, message: 'التلميح غير صالح.' };
  const clue = payload.clue.trim();
  if (clue.length < 1 || clue.length > 120 || /[\r\n\t]/u.test(clue)) {
    return { ok: false, message: 'اكتب تلميحًا قصيرًا من سطر واحد (120 حرفًا كحد أقصى).' };
  }
  const accepted = acceptRequest(match, payload.requestId);
  return {
    ok: true,
    changed: true,
    match: {
      ...accepted,
      turn: {
        ...accepted.turn,
        phase: 'guessing',
        clue,
        deadlineAtMs: now + accepted.settings.guessingSeconds * 1000,
      },
    },
  };
}

export function proposeSameWavelengthPosition(
  match: SameWavelengthMatchState,
  playerId: string,
  payload: { turnId: string; position: unknown; requestId: string },
  now = Date.now(),
): ActionResult {
  const requestError = validateRequest(match, payload.requestId);
  if (requestError) return { ok: false, message: requestError };
  if (
    match.turn.turnId !== payload.turnId ||
    match.turn.phase !== 'guessing' ||
    (match.turn.deadlineAtMs !== null && now >= match.turn.deadlineAtMs)
  ) {
    return { ok: false, message: 'اختيار الموقع غير متاح الآن.' };
  }
  if (!eligibleGuesserIds(match).includes(playerId)) {
    return { ok: false, message: 'لا تملك صلاحية وضع علامة في هذا الدور.' };
  }
  if (match.settings.mode === 'individual' && match.turn.proposals[playerId]?.confirmed) {
    return { ok: false, message: 'تم تثبيت تخمينك ولا يمكن تغييره.' };
  }
  if (!validPosition(payload.position)) {
    return { ok: false, message: 'يجب أن يكون الموقع عددًا صحيحًا بين 0 و100.' };
  }
  const accepted = acceptRequest(match, payload.requestId);
  return {
    ok: true,
    changed: true,
    match: {
      ...accepted,
      turn: {
        ...accepted.turn,
        proposals: {
          ...accepted.turn.proposals,
          [playerId]: { position: payload.position, confirmed: false },
        },
      },
    },
  };
}

export function confirmSameWavelengthPosition(
  match: SameWavelengthMatchState,
  playerId: string,
  payload: { turnId: string; requestId: string },
  now = Date.now(),
): ActionResult {
  const requestError = validateRequest(match, payload.requestId);
  if (requestError) return { ok: false, message: requestError };
  if (
    match.turn.turnId !== payload.turnId ||
    match.turn.phase !== 'guessing' ||
    (match.turn.deadlineAtMs !== null && now >= match.turn.deadlineAtMs)
  ) {
    return { ok: false, message: 'انتهت مرحلة التأكيد.' };
  }
  if (!eligibleGuesserIds(match).includes(playerId)) {
    return { ok: false, message: 'لا تملك صلاحية تأكيد علامة في هذا الدور.' };
  }
  const proposal = match.turn.proposals[playerId];
  if (!proposal) return { ok: false, message: 'اختر موقعًا قبل التأكيد.' };
  const accepted = acceptRequest(match, payload.requestId);
  let next: SameWavelengthMatchState = {
    ...accepted,
    turn: {
      ...accepted.turn,
      proposals: {
        ...accepted.turn.proposals,
        [playerId]: { ...proposal, confirmed: true },
      },
    },
  };
  const guessers = eligibleGuesserIds(next);
  const complete =
    guessers.length > 0 &&
    guessers.every((id) => next.turn.proposals[id]?.confirmed === true) &&
    (next.settings.mode === 'individual' ||
      guessers.every(
        (id) => next.turn.proposals[id]?.position === next.turn.proposals[guessers[0]!]!.position,
      ));
  if (complete) next = finalizeTurn(next, 'scored', now);
  return { ok: true, changed: true, match: next };
}

function completeMatch(
  match: SameWavelengthMatchState,
  now: number,
  completedNormally: boolean,
): SameWavelengthMatchState {
  return {
    ...match,
    completedNormally,
    turn: {
      ...match.turn,
      phase: 'completed',
      deadlineAtMs: now + SAME_WAVELENGTH_MATCH_RESULTS_MS,
      resultReason: completedNormally ? match.turn.resultReason : 'interrupted',
    },
  };
}

export function advanceSameWavelengthTurn(
  match: SameWavelengthMatchState,
  expectedTurnId: string,
  now = Date.now(),
  random: () => number = Math.random,
): SameWavelengthMatchState | null {
  if (match.turn.turnId !== expectedTurnId || match.turn.phase !== 'turn-results') return null;
  if (match.settings.mode === 'team' && match.turn.activeTeam === 'red') {
    const next = createTurn({
      settings: match.settings,
      currentRound: match.currentRound,
      activeTeam: 'blue',
      assignments: match.assignments,
      clueRotationPlayerIds: match.clueRotationPlayerIds,
      departedPlayerIds: match.departedPlayerIds,
      usedSpectrumIds: match.usedSpectrumIds,
      random,
      now,
    });
    return { ...match, usedSpectrumIds: next.usedSpectrumIds, turn: next.turn };
  }
  if (match.currentRound >= match.settings.roundCount) return completeMatch(match, now, true);
  const currentRound = match.currentRound + 1;
  const next = createTurn({
    settings: match.settings,
    currentRound,
    activeTeam: match.settings.mode === 'team' ? 'red' : null,
    assignments: match.assignments,
    clueRotationPlayerIds: match.clueRotationPlayerIds,
    departedPlayerIds: match.departedPlayerIds,
    usedSpectrumIds: match.usedSpectrumIds,
    random,
    now,
  });
  if (!next.turn.clueGiverPlayerId) return completeMatch(match, now, false);
  return {
    ...match,
    currentRound,
    usedSpectrumIds: next.usedSpectrumIds,
    turn: next.turn,
  };
}

export function expireSameWavelengthPhase(
  match: SameWavelengthMatchState,
  expectedTurnId: string,
  expectedPhase: SameWavelengthMatchState['turn']['phase'],
  now = Date.now(),
  random: () => number = Math.random,
): SameWavelengthMatchState | null {
  if (
    match.turn.turnId !== expectedTurnId ||
    match.turn.phase !== expectedPhase ||
    match.turn.deadlineAtMs === null ||
    now < match.turn.deadlineAtMs
  ) {
    return null;
  }
  if (expectedPhase === 'clue-writing') return finalizeTurn(match, 'no-clue', now);
  if (expectedPhase === 'guessing') {
    if (match.settings.mode === 'team') {
      const guessers = eligibleGuesserIds(match);
      const unanimous =
        guessers.length > 0 &&
        guessers.every((id) => match.turn.proposals[id]?.confirmed === true) &&
        guessers.every(
          (id) =>
            match.turn.proposals[id]?.position === match.turn.proposals[guessers[0]!]!.position,
        );
      return finalizeTurn(match, unanimous ? 'scored' : 'no-consensus', now);
    }
    return finalizeTurn(match, 'scored', now);
  }
  if (expectedPhase === 'turn-results') {
    return advanceSameWavelengthTurn(match, expectedTurnId, now, random);
  }
  return null;
}

export function handleSameWavelengthPermanentLeave(
  match: SameWavelengthMatchState,
  playerId: string,
  now = Date.now(),
): SameWavelengthMatchState {
  if (!match.playerIds.includes(playerId) || match.departedPlayerIds.includes(playerId))
    return match;
  const departedPlayerIds = [...match.departedPlayerIds, playerId];
  const remaining = match.playerIds.filter((id) => !departedPlayerIds.includes(id));
  let next: SameWavelengthMatchState = { ...match, departedPlayerIds };
  if (match.turn.phase === 'completed') return next;
  if (match.settings.mode === 'individual') {
    if (remaining.length < 2) return completeMatch(next, now, false);
    if (match.turn.clueGiverPlayerId === playerId) return finalizeTurn(next, 'no-clue', now);
    return next;
  }
  const assignment = match.assignments[playerId];
  const team = assignment?.team;
  if (assignment?.role === 'clue-giver') return completeMatch(next, now, false);
  if (team) {
    const remainingGuessers = remaining.filter(
      (id) => match.assignments[id]?.team === team && match.assignments[id]?.role === 'guesser',
    );
    if (remainingGuessers.length === 0) return completeMatch(next, now, false);
    const proposals = { ...match.turn.proposals };
    delete proposals[playerId];
    if (match.turn.activeTeam === team && match.turn.phase === 'guessing') {
      for (const id of remainingGuessers) {
        if (proposals[id]) proposals[id] = { ...proposals[id]!, confirmed: false };
      }
    }
    next = { ...next, turn: { ...next.turn, proposals } };
  }
  return next;
}

function resultEntry(match: SameWavelengthMatchState, playerId: string): SameWavelengthResultEntry {
  const proposal = match.turn.proposals[playerId];
  const guess = proposal?.position ?? null;
  const distance = guess === null ? null : Math.abs(guess - match.turn.target);
  const closeness = distance === null ? null : 100 - distance;
  return {
    playerId,
    name: match.playerNames[playerId] ?? 'لاعب',
    guess,
    distance,
    closeness,
    points: sameWavelengthPoints(match.turn.target, guess),
    totalPoints: match.scores[playerId] ?? 0,
  };
}

function leaderboard(match: SameWavelengthMatchState): SameWavelengthLeaderboardEntry[] {
  const maximum = Math.max(...match.playerIds.map((id) => match.scores[id] ?? 0), 0);
  return match.playerIds
    .map((playerId) => ({
      playerId,
      name: match.playerNames[playerId] ?? 'لاعب',
      score: match.scores[playerId] ?? 0,
      isWinner: match.completedNormally === true && (match.scores[playerId] ?? 0) === maximum,
    }))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'ar'));
}

function teamSummaries(match: SameWavelengthMatchState): SameWavelengthTeamSummary[] {
  const maximum = Math.max(match.teamScores.red, match.teamScores.blue);
  return (['red', 'blue'] as const).map((team) => ({
    team,
    score: match.teamScores[team],
    memberNames: match.playerIds
      .filter((id) => match.assignments[id]?.team === team)
      .map((id) => match.playerNames[id] ?? 'لاعب'),
    isWinner: match.completedNormally === true && match.teamScores[team] === maximum,
  }));
}

export function buildSameWavelengthPlayerView(
  match: SameWavelengthMatchState,
  playerId: string,
  shell: GameShellState,
  now = Date.now(),
): SameWavelengthPlayerView {
  const revealed = match.turn.phase === 'turn-results' || match.turn.phase === 'completed';
  const isParticipant =
    (shell.matchParticipantIds ?? match.playerIds).includes(playerId) &&
    match.playerIds.includes(playerId) &&
    !match.departedPlayerIds.includes(playerId);
  const assignment = match.assignments[playerId] ?? null;
  const isClueGiver = match.turn.clueGiverPlayerId === playerId;
  const eligibleGuesser = eligibleGuesserIds(match).includes(playerId);
  const ownProposal = match.turn.proposals[playerId] ?? null;
  const canSeeTeamProposals =
    match.settings.mode === 'team' && assignment?.team === match.turn.activeTeam;
  const proposals: SameWavelengthProposalView[] = canSeeTeamProposals
    ? eligibleGuesserIds(match).map((id) => {
        const proposal = match.turn.proposals[id];
        return {
          playerId: id,
          name: match.playerNames[id] ?? 'لاعب',
          position: proposal?.position ?? null,
          confirmed: proposal?.confirmed ?? false,
        };
      })
    : [];
  const resultIds = match.playerIds.filter((id) => id !== match.turn.clueGiverPlayerId);
  const turnDistance =
    revealed && match.turn.agreedGuess !== null
      ? Math.abs(match.turn.target - match.turn.agreedGuess)
      : null;
  return {
    gameId: SAME_WAVELENGTH_GAME_ID,
    selfPlayerId: playerId,
    matchId: match.matchId,
    turnId: match.turn.turnId,
    mode: match.settings.mode,
    phase: match.turn.phase,
    settings: { ...match.settings },
    currentRound: match.currentRound,
    totalRounds: match.settings.roundCount,
    activeTeam: match.turn.activeTeam,
    teamTurnNumber: match.turn.teamTurnNumber,
    leftLabel: match.turn.leftLabel,
    rightLabel: match.turn.rightLabel,
    clueGiverPlayerId: match.turn.clueGiverPlayerId,
    clueGiverName: match.turn.clueGiverPlayerId
      ? (match.playerNames[match.turn.clueGiverPlayerId] ?? 'لاعب')
      : null,
    selfAssignment: assignment,
    isSpectator: !isParticipant,
    isClueGiver,
    canSubmitClue: isParticipant && isClueGiver && match.turn.phase === 'clue-writing',
    canPropose:
      isParticipant &&
      eligibleGuesser &&
      match.turn.phase === 'guessing' &&
      (match.settings.mode !== 'individual' || !ownProposal?.confirmed),
    canConfirm:
      isParticipant &&
      eligibleGuesser &&
      match.turn.phase === 'guessing' &&
      ownProposal !== null &&
      !ownProposal.confirmed,
    canAdvance: shell.hostPlayerId === playerId && match.turn.phase === 'turn-results',
    clue: match.turn.phase === 'clue-writing' ? null : match.turn.clue,
    privateTarget: isClueGiver && !revealed ? match.turn.target : null,
    revealedTarget: revealed ? match.turn.target : null,
    ownProposal: ownProposal?.position ?? null,
    ownConfirmed: ownProposal?.confirmed ?? false,
    teamProposals: proposals,
    agreedGuess: revealed ? match.turn.agreedGuess : null,
    turnDistance,
    turnCloseness: turnDistance === null ? null : 100 - turnDistance,
    turnPoints:
      revealed && match.settings.mode === 'team'
        ? sameWavelengthPoints(match.turn.target, match.turn.agreedGuess)
        : null,
    deadlineAtMs: match.turn.deadlineAtMs,
    remainingSeconds:
      match.turn.deadlineAtMs === null
        ? null
        : Math.max(0, Math.ceil((match.turn.deadlineAtMs - now) / 1000)),
    roundResults:
      revealed && match.settings.mode === 'individual'
        ? resultIds.map((id) => resultEntry(match, id))
        : [],
    leaderboard: leaderboard(match),
    teamSummaries: teamSummaries(match),
    completedNormally: match.turn.phase === 'completed' ? match.completedNormally : null,
    resultReason: revealed ? match.turn.resultReason : null,
  };
}
