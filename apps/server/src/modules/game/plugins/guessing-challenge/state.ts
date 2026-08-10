import type {
  GameContentSettings,
  GameShellPlayer,
  GameShellState,
  GuessingChallengeCardConfirmStatus,
  GuessingChallengeIdentitySecret,
  GuessingChallengeLookDirection,
  GuessingChallengeMatchState,
  GuessingChallengeMode,
  GuessingChallengePlayerView,
  GuessingChallengeRevealEntry,
  GuessingChallengeRoundState,
  GuessingChallengeSeat,
  GuessingChallengeSpecialCard,
  GuessingChallengeTeamId,
  GuessingChallengeVisibleIdentity,
} from '@wanasatna/shared';
import {
  GUESSING_CHALLENGE_DEFAULT_ROUNDS,
  GUESSING_CHALLENGE_LOOK_THROTTLE_MS,
  GUESSING_CHALLENGE_MAX_GUESS_LENGTH,
  GUESSING_CHALLENGE_YELLOW_QUESTIONS,
} from '@wanasatna/shared';
import { resolveMatchRounds } from '../../../../config/test-timers.js';
import { getRoomRoundCategory } from '../../runtime/round-category-store.js';
import {
  getIdentitiesForCategory,
  identityMatchesGuess,
  pickReplacementIdentity,
  pickTwoIdentities,
  resolveCategoryPool,
} from './identities.js';
import {
  buildLeaderboardEntries,
  buildResultsLeaderboardEntries,
  buildRoundResultEntries,
} from './scoring.js';

const PHASE_LABELS = {
  playing: 'التخمين',
  'round-results': 'نتائج الجولة',
  'match-completed': 'انتهت المباراة',
} as const;

const TEAM_LABELS: Record<GuessingChallengeTeamId, string> = {
  blue: 'الفريق الأزرق',
  red: 'الفريق الأحمر',
};

const MAX_RECENT_IDENTITY_IDS = 32;

const lookThrottleByKey = new Map<string, number>();

export function resolveTotalRounds(settings: GameContentSettings): number {
  return resolveMatchRounds(settings.rounds, GUESSING_CHALLENGE_DEFAULT_ROUNDS);
}

export function resolveGuessingChallengeMode(
  settings: GameContentSettings,
  pluginMode?: unknown,
): GuessingChallengeMode {
  if (pluginMode === '1v1' || pluginMode === '2v2') {
    return pluginMode;
  }
  if (settings.mode === '1v1' || settings.mode === '2v2') {
    return settings.mode;
  }
  return '1v1';
}

export function requiredPlayerCountForMode(mode: GuessingChallengeMode): number {
  return mode === '2v2' ? 4 : 2;
}

export function getOpponentTeamId(teamId: GuessingChallengeTeamId): GuessingChallengeTeamId {
  return teamId === 'blue' ? 'red' : 'blue';
}

export function withRound(
  match: GuessingChallengeMatchState,
  round: GuessingChallengeRoundState,
): GuessingChallengeMatchState {
  return { ...match, round };
}

export function createInitialScores(playerIds: string[]): Record<string, number> {
  return Object.fromEntries(playerIds.map((playerId) => [playerId, 0]));
}

export function createInitialTeamCards(): GuessingChallengeMatchState['teamCards'] {
  return {
    blue: { yellowUsed: false, redUsed: false },
    red: { yellowUsed: false, redUsed: false },
  };
}

export function createInitialTeamScores(): GuessingChallengeMatchState['teamScores'] {
  return { blue: 0, red: 0 };
}

export function createInitialLooks(playerIds: string[]): Record<string, GuessingChallengeLookDirection> {
  return Object.fromEntries(playerIds.map((playerId) => [playerId, { yaw: 0, pitch: 0 }]));
}

/**
 * Deterministic team assignment:
 * 1v1: P0→blue0, P1→red0
 * 2v2: P0→blue0, P1→red0, P2→blue1, P3→red1
 */
export function assignTeams(
  playerIds: readonly string[],
  mode: GuessingChallengeMode,
): {
  teamByPlayerId: Record<string, GuessingChallengeTeamId>;
  seatByPlayerId: Record<string, GuessingChallengeSeat>;
} {
  const expected = requiredPlayerCountForMode(mode);
  if (playerIds.length !== expected) {
    throw new Error(`Guessing Challenge ${mode} requires exactly ${expected} players.`);
  }

  const teamByPlayerId: Record<string, GuessingChallengeTeamId> = {};
  const seatByPlayerId: Record<string, GuessingChallengeSeat> = {};

  if (mode === '1v1') {
    teamByPlayerId[playerIds[0]!] = 'blue';
    seatByPlayerId[playerIds[0]!] = 0;
    teamByPlayerId[playerIds[1]!] = 'red';
    seatByPlayerId[playerIds[1]!] = 0;
    return { teamByPlayerId, seatByPlayerId };
  }

  teamByPlayerId[playerIds[0]!] = 'blue';
  seatByPlayerId[playerIds[0]!] = 0;
  teamByPlayerId[playerIds[1]!] = 'red';
  seatByPlayerId[playerIds[1]!] = 0;
  teamByPlayerId[playerIds[2]!] = 'blue';
  seatByPlayerId[playerIds[2]!] = 1;
  teamByPlayerId[playerIds[3]!] = 'red';
  seatByPlayerId[playerIds[3]!] = 1;

  return { teamByPlayerId, seatByPlayerId };
}

export function getTeamPlayerIds(
  match: GuessingChallengeMatchState,
  teamId: GuessingChallengeTeamId,
): string[] {
  return match.playerIds.filter((playerId) => match.teamByPlayerId[playerId] === teamId);
}

export function getTeamSeat0PlayerId(
  match: GuessingChallengeMatchState,
  teamId: GuessingChallengeTeamId,
): string | null {
  const members = getTeamPlayerIds(match, teamId).sort(
    (left, right) => (match.seatByPlayerId[left] ?? 0) - (match.seatByPlayerId[right] ?? 0),
  );
  return members[0] ?? null;
}

function toVisibleIdentity(
  identity: GuessingChallengeIdentitySecret,
): GuessingChallengeVisibleIdentity {
  return {
    type: identity.type,
    value: identity.type === 'text' ? identity.value : null,
    imageUrl: identity.type === 'image' ? identity.imageUrl : null,
  };
}

export function createRoundState(
  roomId: string,
  teamByPlayerId: Record<string, GuessingChallengeTeamId>,
  startingTeamId: GuessingChallengeTeamId,
  recentIdentityIds: readonly string[],
): GuessingChallengeRoundState {
  const { categoryId, identities } = resolveCategoryPool(roomId);
  const [identityBlue, identityRed] = pickTwoIdentities(identities, recentIdentityIds);

  if (!Object.values(teamByPlayerId).includes('blue') || !Object.values(teamByPlayerId).includes('red')) {
    throw new Error('Guessing Challenge requires both teams.');
  }

  return {
    gamePhase: 'playing',
    phaseRemainingSeconds: 0,
    resolvedCategoryId: categoryId,
    identitiesByTeamId: {
      blue: identityBlue,
      red: identityRed,
    },
    usedIdentityIds: [identityBlue.id, identityRed.id],
    currentTurnTeamId: startingTeamId,
    startingTeamId,
    yellowQuestionsRemaining: null,
    winningTeamId: null,
    winningPlayerId: null,
    winningGuess: null,
    identityChangedNoticeTeamId: null,
    cardConfirm: null,
  };
}

export function createMatchState(
  roomId: string,
  players: GameShellPlayer[],
  settings: GameContentSettings,
  modeOverride?: GuessingChallengeMode,
  teamAssignment?: {
    teamByPlayerId: Record<string, GuessingChallengeTeamId>;
    seatByPlayerId: Record<string, GuessingChallengeSeat>;
  },
): GuessingChallengeMatchState {
  const mode = modeOverride ?? resolveGuessingChallengeMode(settings);
  const expected = requiredPlayerCountForMode(mode);

  if (players.length !== expected) {
    throw new Error(`Guessing Challenge ${mode} requires exactly ${expected} players.`);
  }

  const playerIds = players.map((player) => player.id);
  const { teamByPlayerId, seatByPlayerId } = teamAssignment ?? assignTeams(playerIds, mode);

  for (const playerId of playerIds) {
    if (!teamByPlayerId[playerId] || seatByPlayerId[playerId] === undefined) {
      throw new Error('Guessing Challenge team assignment is incomplete.');
    }
  }

  const startingTeamId: GuessingChallengeTeamId = 'blue';
  const round = createRoundState(roomId, teamByPlayerId, startingTeamId, []);

  return {
    mode,
    playerIds,
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    teamByPlayerId,
    seatByPlayerId,
    teamCards: createInitialTeamCards(),
    teamScores: createInitialTeamScores(),
    scores: createInitialScores(playerIds),
    lookByPlayerId: createInitialLooks(playerIds),
    currentRound: 1,
    totalRounds: resolveTotalRounds(settings),
    matchStatus: 'in-progress',
    nextStartingTeamId: 'red',
    recentIdentityIds: [...round.usedIdentityIds],
    round,
  };
}

export function appendRecentIdentityIds(
  recentIdentityIds: readonly string[],
  identityIds: readonly string[],
): string[] {
  const next = [...recentIdentityIds];

  for (const identityId of identityIds) {
    const existing = next.indexOf(identityId);
    if (existing >= 0) {
      next.splice(existing, 1);
    }
    next.push(identityId);
  }

  return next.slice(-MAX_RECENT_IDENTITY_IDS);
}

export function getConnectedParticipantIds(
  match: GuessingChallengeMatchState,
  shell: GameShellState,
): string[] {
  const connected = new Set(
    shell.players.filter((player) => player.isConnected).map((player) => player.id),
  );

  return match.playerIds.filter((playerId) => connected.has(playerId));
}

export function getConnectedTeamPlayerIds(
  match: GuessingChallengeMatchState,
  shell: GameShellState,
  teamId: GuessingChallengeTeamId,
): string[] {
  const connected = new Set(getConnectedParticipantIds(match, shell));
  return getTeamPlayerIds(match, teamId).filter((playerId) => connected.has(playerId));
}

export function normalizeGuessInput(guess: string): string | null {
  const trimmed = guess.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > GUESSING_CHALLENGE_MAX_GUESS_LENGTH) {
    return null;
  }
  return trimmed;
}

function clampLookAxis(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, value));
}

export function resetPlayerLook(
  match: GuessingChallengeMatchState,
  playerId: string,
): GuessingChallengeMatchState {
  if (!match.lookByPlayerId[playerId]) {
    return match;
  }

  return {
    ...match,
    lookByPlayerId: {
      ...match.lookByPlayerId,
      [playerId]: { yaw: 0, pitch: 0 },
    },
  };
}

/**
 * Apply look direction with per-player throttle (~100ms). Returns null when throttled.
 */
export function applyLookDirection(
  match: GuessingChallengeMatchState,
  roomId: string,
  playerId: string,
  yaw: number,
  pitch: number,
  nowMs = Date.now(),
): { match: GuessingChallengeMatchState; yaw: number; pitch: number } | null {
  if (!match.playerIds.includes(playerId)) {
    return null;
  }

  const key = `${roomId}:${playerId}`;
  const last = lookThrottleByKey.get(key) ?? 0;
  if (nowMs - last < GUESSING_CHALLENGE_LOOK_THROTTLE_MS) {
    return null;
  }
  lookThrottleByKey.set(key, nowMs);

  const nextYaw = clampLookAxis(yaw);
  const nextPitch = clampLookAxis(pitch);

  return {
    match: {
      ...match,
      lookByPlayerId: {
        ...match.lookByPlayerId,
        [playerId]: { yaw: nextYaw, pitch: nextPitch },
      },
    },
    yaw: nextYaw,
    pitch: nextPitch,
  };
}

export function clearLookThrottleForRoom(roomId: string): void {
  for (const key of lookThrottleByKey.keys()) {
    if (key.startsWith(`${roomId}:`)) {
      lookThrottleByKey.delete(key);
    }
  }
}

function isOnCurrentTurnTeam(match: GuessingChallengeMatchState, playerId: string): boolean {
  return match.teamByPlayerId[playerId] === match.round.currentTurnTeamId;
}

function clearCardConfirm(round: GuessingChallengeRoundState): GuessingChallengeRoundState {
  if (!round.cardConfirm) {
    return round;
  }
  return { ...round, cardConfirm: null };
}

function passTurn(match: GuessingChallengeMatchState): GuessingChallengeMatchState {
  const remaining = match.round.yellowQuestionsRemaining;

  if (remaining !== null && remaining > 1) {
    return withRound(match, {
      ...clearCardConfirm(match.round),
      yellowQuestionsRemaining: remaining - 1,
      identityChangedNoticeTeamId: null,
    });
  }

  const nextTeamId = getOpponentTeamId(match.round.currentTurnTeamId);

  return withRound(match, {
    ...clearCardConfirm(match.round),
    currentTurnTeamId: nextTeamId,
    yellowQuestionsRemaining: null,
    identityChangedNoticeTeamId: null,
  });
}

export function endQuestionTurn(
  match: GuessingChallengeMatchState,
  playerId: string,
): { ok: true; match: GuessingChallengeMatchState } | { ok: false; message: string } {
  if (match.round.gamePhase !== 'playing' || match.round.winningTeamId) {
    return { ok: false, message: 'انتهت هذه الجولة.' };
  }

  if (!isOnCurrentTurnTeam(match, playerId)) {
    return { ok: false, message: 'ليس دورك الآن' };
  }

  return { ok: true, match: passTurn(match) };
}

function activateYellowCard(
  match: GuessingChallengeMatchState,
  teamId: GuessingChallengeTeamId,
): { ok: true; match: GuessingChallengeMatchState } | { ok: false; message: string } {
  const cards = match.teamCards[teamId];
  if (!cards || cards.yellowUsed) {
    return { ok: false, message: 'استخدمت هذه البطاقة بالفعل' };
  }

  if (match.round.yellowQuestionsRemaining !== null) {
    return { ok: false, message: 'البطاقة الصفراء مفعّلة بالفعل' };
  }

  return {
    ok: true,
    match: {
      ...match,
      teamCards: {
        ...match.teamCards,
        [teamId]: { ...cards, yellowUsed: true },
      },
      round: {
        ...clearCardConfirm(match.round),
        yellowQuestionsRemaining: GUESSING_CHALLENGE_YELLOW_QUESTIONS,
        identityChangedNoticeTeamId: null,
      },
    },
  };
}

function activateRedCard(
  match: GuessingChallengeMatchState,
  teamId: GuessingChallengeTeamId,
): { ok: true; match: GuessingChallengeMatchState } | { ok: false; message: string } {
  const cards = match.teamCards[teamId];
  if (!cards || cards.redUsed) {
    return { ok: false, message: 'استخدمت هذه البطاقة بالفعل' };
  }

  const opponentTeamId = getOpponentTeamId(teamId);
  const ownIdentity = match.round.identitiesByTeamId[teamId];
  const opponentIdentity = match.round.identitiesByTeamId[opponentTeamId];
  if (!ownIdentity || !opponentIdentity) {
    return { ok: false, message: 'تعذر تغيير الهوية.' };
  }

  const pool = getIdentitiesForCategory(match.round.resolvedCategoryId);

  const replacement = pickReplacementIdentity(pool, {
    currentOpponentId: opponentIdentity.id,
    ownIdentityId: ownIdentity.id,
    usedIdentityIds: match.round.usedIdentityIds,
  });

  if (!replacement) {
    return { ok: false, message: 'لا توجد هوية بديلة متاحة.' };
  }

  return {
    ok: true,
    match: {
      ...match,
      teamCards: {
        ...match.teamCards,
        [teamId]: { ...cards, redUsed: true },
      },
      round: {
        ...clearCardConfirm(match.round),
        identitiesByTeamId: {
          ...match.round.identitiesByTeamId,
          [opponentTeamId]: replacement,
        },
        usedIdentityIds: [...match.round.usedIdentityIds, replacement.id],
        identityChangedNoticeTeamId: opponentTeamId,
      },
    },
  };
}

/**
 * Confirm special-card use.
 * 1v1: single confirm activates.
 * 2v2: all CONNECTED teammates must confirm (at least 1); activates atomically once.
 * USE_YELLOW / USE_RED socket events mean "confirm card use".
 */
export function confirmSpecialCard(
  getMatch: () => GuessingChallengeMatchState | null,
  setMatch: (match: GuessingChallengeMatchState) => void,
  shell: GameShellState,
  playerId: string,
  card: GuessingChallengeSpecialCard,
):
  | { ok: true; activated: boolean; match: GuessingChallengeMatchState }
  | { ok: false; message: string; match: GuessingChallengeMatchState | null } {
  const match = getMatch();

  if (!match || match.round.gamePhase !== 'playing' || match.round.winningTeamId) {
    return { ok: false, message: 'انتهت هذه الجولة.', match };
  }

  if (!isOnCurrentTurnTeam(match, playerId)) {
    return { ok: false, message: 'ليس دورك الآن', match };
  }

  const teamId = match.teamByPlayerId[playerId];
  if (!teamId) {
    return { ok: false, message: 'لست مشاركاً في هذه المباراة.', match };
  }

  const cards = match.teamCards[teamId];
  if (!cards) {
    return { ok: false, message: 'تعذر استخدام البطاقة.', match };
  }

  if (card === 'yellow' && cards.yellowUsed) {
    return { ok: false, message: 'استخدمت هذه البطاقة بالفعل', match };
  }
  if (card === 'red' && cards.redUsed) {
    return { ok: false, message: 'استخدمت هذه البطاقة بالفعل', match };
  }

  if (card === 'yellow' && match.round.yellowQuestionsRemaining !== null) {
    return { ok: false, message: 'البطاقة الصفراء مفعّلة بالفعل', match };
  }

  const connectedTeammates = getConnectedTeamPlayerIds(match, shell, teamId);
  if (connectedTeammates.length === 0 || !connectedTeammates.includes(playerId)) {
    return { ok: false, message: 'تعذر تأكيد البطاقة.', match };
  }

  const existing = match.round.cardConfirm;
  let confirmedPlayerIds: string[];

  if (existing && existing.card === card && existing.teamId === teamId) {
    if (existing.confirmedPlayerIds.includes(playerId)) {
      // Duplicate confirm ignored — return current state.
      return { ok: true, activated: false, match };
    }
    confirmedPlayerIds = [...existing.confirmedPlayerIds, playerId];
  } else {
    confirmedPlayerIds = [playerId];
  }

  const requiredIds = connectedTeammates;
  const allConfirmed = requiredIds.every((id) => confirmedPlayerIds.includes(id));

  if (!allConfirmed) {
    const nextMatch = withRound(match, {
      ...match.round,
      cardConfirm: { card, teamId, confirmedPlayerIds },
      identityChangedNoticeTeamId: null,
    });
    setMatch(nextMatch);
    return { ok: true, activated: false, match: nextMatch };
  }

  const activated =
    card === 'yellow' ? activateYellowCard(match, teamId) : activateRedCard(match, teamId);

  if (!activated.ok) {
    return { ok: false, message: activated.message, match };
  }

  setMatch(activated.match);
  return { ok: true, activated: true, match: activated.match };
}

/**
 * Reject a pending team card confirmation.
 * Clears pending state for both teammates; card remains AVAILABLE (not consumed).
 */
export function rejectSpecialCard(
  getMatch: () => GuessingChallengeMatchState | null,
  setMatch: (match: GuessingChallengeMatchState) => void,
  shell: GameShellState,
  playerId: string,
):
  | { ok: true; match: GuessingChallengeMatchState }
  | { ok: false; message: string; match: GuessingChallengeMatchState | null } {
  const match = getMatch();

  if (!match || match.round.gamePhase !== 'playing') {
    return { ok: false, message: 'انتهت هذه الجولة.', match };
  }

  const teamId = match.teamByPlayerId[playerId];
  if (!teamId) {
    return { ok: false, message: 'لست مشاركاً في هذه المباراة.', match };
  }

  const confirm = match.round.cardConfirm;
  if (!confirm || confirm.teamId !== teamId) {
    return { ok: false, message: 'لا يوجد طلب بطاقة معلّق.', match };
  }

  const teammates = getConnectedTeamPlayerIds(match, shell, teamId);
  if (!teammates.includes(playerId)) {
    return { ok: false, message: 'تعذر رفض البطاقة.', match };
  }

  const nextMatch = withRound(match, {
    ...clearCardConfirm(match.round),
    identityChangedNoticeTeamId: null,
  });
  setMatch(nextMatch);
  return { ok: true, match: nextMatch };
}

/**
 * Atomic final-guess handling. Correct guess claims winner once (team-based).
 * Wrong guess passes turn (and ends yellow sequence).
 */
export function applyFinalGuess(
  getMatch: () => GuessingChallengeMatchState | null,
  setMatch: (match: GuessingChallengeMatchState) => void,
  playerId: string,
  guess: string,
):
  | { accepted: true; correct: true; match: GuessingChallengeMatchState }
  | { accepted: true; correct: false; match: GuessingChallengeMatchState }
  | { accepted: false; message: string; match: GuessingChallengeMatchState | null } {
  const match = getMatch();

  if (!match || match.round.gamePhase !== 'playing' || match.round.winningTeamId) {
    return { accepted: false, message: 'انتهت هذه الجولة.', match };
  }

  if (!isOnCurrentTurnTeam(match, playerId)) {
    return { accepted: false, message: 'ليس دورك الآن', match };
  }

  const normalized = normalizeGuessInput(guess);
  if (!normalized) {
    return { accepted: false, message: 'اكتب تخمينك أولًا', match };
  }

  const teamId = match.teamByPlayerId[playerId];
  if (!teamId) {
    return { accepted: false, message: 'تعذر التحقق من التخمين.', match };
  }

  const ownIdentity = match.round.identitiesByTeamId[teamId];
  if (!ownIdentity) {
    return { accepted: false, message: 'تعذر التحقق من التخمين.', match };
  }

  if (!identityMatchesGuess(ownIdentity, normalized)) {
    const opponentTeamId = getOpponentTeamId(teamId);

    // Wrong guess always ends the turn (including any yellow sequence).
    const nextMatch = withRound(match, {
      ...clearCardConfirm(match.round),
      currentTurnTeamId: opponentTeamId,
      yellowQuestionsRemaining: null,
      identityChangedNoticeTeamId: null,
    });
    setMatch(nextMatch);
    return { accepted: true, correct: false, match: nextMatch };
  }

  const claimed = withRound(match, {
    ...clearCardConfirm(match.round),
    winningTeamId: teamId,
    winningPlayerId: playerId,
    winningGuess: normalized,
    yellowQuestionsRemaining: null,
    identityChangedNoticeTeamId: null,
  });
  setMatch(claimed);
  return { accepted: true, correct: true, match: claimed };
}

function buildRevealEntries(match: GuessingChallengeMatchState): GuessingChallengeRevealEntry[] {
  return match.playerIds.map((playerId) => {
    const teamId = match.teamByPlayerId[playerId]!;
    const identity = match.round.identitiesByTeamId[teamId]!;
    return {
      playerId,
      name: match.playerNames[playerId] ?? 'لاعب',
      identity: toVisibleIdentity(identity),
      isWinner: teamId === match.round.winningTeamId,
    };
  });
}

function buildRoundResultsInteractionView(
  match: GuessingChallengeMatchState,
  shell: GameShellState,
  playerId: string,
): Pick<
  GuessingChallengePlayerView,
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

function buildCardConfirmStatus(
  match: GuessingChallengeMatchState,
  shell: GameShellState,
  playerId: string,
  teamId: GuessingChallengeTeamId,
): GuessingChallengeCardConfirmStatus | null {
  const confirm = match.round.cardConfirm;
  if (!confirm || confirm.teamId !== teamId || match.round.gamePhase !== 'playing') {
    return null;
  }

  const requiredCount = Math.max(1, getConnectedTeamPlayerIds(match, shell, teamId).length);
  const confirmedCount = confirm.confirmedPlayerIds.length;
  const selfConfirmed = confirm.confirmedPlayerIds.includes(playerId);
  const requestingPlayerId = confirm.confirmedPlayerIds[0] ?? playerId;
  const requestingPlayerName = match.playerNames[requestingPlayerId] ?? 'زميلك';
  const cardTitle = confirm.card === 'yellow' ? 'البطاقة الصفراء' : 'البطاقة الحمراء';

  return {
    card: confirm.card,
    confirmedCount,
    requiredCount,
    selfConfirmed,
    requestingPlayerId,
    requestingPlayerName,
    message: selfConfirmed
      ? `بانتظار موافقة شريكك (${confirmedCount}/${requiredCount})`
      : `${requestingPlayerName} يريد استخدام ${cardTitle}`,
  };
}

function buildWinnerName(match: GuessingChallengeMatchState): string | null {
  if (!match.round.winningTeamId) {
    return null;
  }

  if (match.mode === '1v1' && match.round.winningPlayerId) {
    return match.playerNames[match.round.winningPlayerId] ?? 'لاعب';
  }

  return TEAM_LABELS[match.round.winningTeamId];
}

export function buildGuessingChallengePlayerView(
  match: GuessingChallengeMatchState,
  playerId: string,
  shell: GameShellState,
): GuessingChallengePlayerView {
  const phase = match.round.gamePhase;
  const revealed = phase === 'round-results' || phase === 'match-completed';
  const isParticipant = match.playerIds.includes(playerId);
  const selfTeam = match.teamByPlayerId[playerId] ?? null;
  const selfSeat = match.seatByPlayerId[playerId] ?? null;
  const opponentTeamId = selfTeam ? getOpponentTeamId(selfTeam) : null;
  const isMyTurn =
    isParticipant &&
    phase === 'playing' &&
    selfTeam === match.round.currentTurnTeamId &&
    !match.round.winningTeamId;

  const teamCards = selfTeam
    ? match.teamCards[selfTeam]
    : { yellowUsed: true, redUsed: true };
  const ownIdentity = selfTeam ? match.round.identitiesByTeamId[selfTeam] : undefined;
  const opponentIdentity = opponentTeamId
    ? match.round.identitiesByTeamId[opponentTeamId]
    : undefined;

  const turnTeamId = match.round.currentTurnTeamId;
  const turnRepresentativeId = getTeamSeat0PlayerId(match, turnTeamId);
  const turnName =
    match.mode === '2v2'
      ? TEAM_LABELS[turnTeamId]
      : (match.playerNames[turnRepresentativeId ?? ''] ?? 'لاعب');

  const look = (id: string) => match.lookByPlayerId[id] ?? { yaw: 0, pitch: 0 };

  const teammateId =
    selfTeam && match.mode === '2v2'
      ? getTeamPlayerIds(match, selfTeam).find((id) => id !== playerId) ?? null
      : null;

  const opponentIds = opponentTeamId
    ? getTeamPlayerIds(match, opponentTeamId).sort(
        (left, right) => (match.seatByPlayerId[left] ?? 0) - (match.seatByPlayerId[right] ?? 0),
      )
    : [];

  const visibleOpponentIdentity =
    opponentIdentity && (phase === 'playing' || revealed)
      ? toVisibleIdentity(opponentIdentity)
      : null;

  const opponents = opponentIds.map((opponentId) => {
    const oppLook = look(opponentId);
    return {
      playerId: opponentId,
      name: match.playerNames[opponentId] ?? 'خصم',
      seat: match.seatByPlayerId[opponentId] ?? 0,
      lookYaw: oppLook.yaw,
      lookPitch: oppLook.pitch,
      visibleIdentity: visibleOpponentIdentity,
    };
  });

  const primaryOpponent = opponents[0];

  const teammate =
    teammateId != null
      ? {
          playerId: teammateId,
          name: match.playerNames[teammateId] ?? 'زميل',
          seat: match.seatByPlayerId[teammateId] ?? 1,
          lookYaw: look(teammateId).yaw,
          lookPitch: look(teammateId).pitch,
        }
      : null;

  return {
    gamePhase: phase,
    phaseLabel: `${PHASE_LABELS[phase]} — الجولة ${match.currentRound}/${match.totalRounds}`,
    phaseRemainingSeconds: match.round.phaseRemainingSeconds,
    categoryId: match.round.resolvedCategoryId,
    nextCategoryId: getRoomRoundCategory(shell.roomId) ?? 'random',
    currentRound: match.currentRound,
    totalRounds: match.totalRounds,
    matchStatus: match.matchStatus,
    mode: match.mode,
    selfTeam,
    selfSeat,
    currentTurnPlayerId: turnRepresentativeId,
    currentTurnTeamId: turnTeamId,
    currentTurnPlayerName: turnName,
    isMyTurn,
    turnInstruction: !isParticipant
      ? null
      : isMyTurn
        ? 'اسأل خصمك سؤالًا'
        : phase === 'playing'
          ? `استمع للسؤال وأجب بنعم أو لا`
          : null,
    self: {
      playerId,
      name: match.playerNames[playerId] ?? 'لاعب',
      identityHidden: true,
      revealedIdentity: revealed && ownIdentity ? toVisibleIdentity(ownIdentity) : null,
      yellowCardAvailable: !teamCards.yellowUsed,
      redCardAvailable: !teamCards.redUsed,
    },
    teammate,
    opponent: {
      playerId: primaryOpponent?.playerId ?? '',
      name: primaryOpponent?.name ?? 'خصم',
      visibleIdentity: visibleOpponentIdentity,
    },
    opponents,
    yellowQuestionsRemaining: isMyTurn ? match.round.yellowQuestionsRemaining : null,
    canEndQuestion: isMyTurn,
    canGuess: isMyTurn,
    canUseYellow:
      isMyTurn && !teamCards.yellowUsed && match.round.yellowQuestionsRemaining === null,
    canUseRed: isMyTurn && !teamCards.redUsed,
    cardConfirmStatus:
      selfTeam && isParticipant
        ? buildCardConfirmStatus(match, shell, playerId, selfTeam)
        : null,
    identityChangedNotice:
      selfTeam !== null &&
      match.round.identityChangedNoticeTeamId === selfTeam &&
      phase === 'playing',
    revealEntries: revealed ? buildRevealEntries(match) : [],
    winnerName: revealed ? buildWinnerName(match) : null,
    winningGuess: revealed ? match.round.winningGuess : null,
    roundResults: revealed ? buildRoundResultEntries(match) : [],
    leaderboard: buildLeaderboardEntries(match),
    resultsLeaderboard: buildResultsLeaderboardEntries(match),
    ...buildRoundResultsInteractionView(match, shell, playerId),
  };
}

/** Test helper: ensure serialized view never contains own secret / acceptedAnswers. */
export function viewContainsSecretLeak(
  view: GuessingChallengePlayerView,
  ownIdentity: GuessingChallengeIdentitySecret,
): boolean {
  const serialized = JSON.stringify(view);
  if (serialized.includes('"acceptedAnswers"')) {
    return true;
  }

  if (!view.revealEntries.length && ownIdentity.value && serialized.includes(ownIdentity.value)) {
    return true;
  }

  for (const accepted of ownIdentity.acceptedAnswers) {
    if (!view.revealEntries.length && accepted && serialized.includes(accepted)) {
      return true;
    }
  }

  return false;
}
