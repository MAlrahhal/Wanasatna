import type {
  GameContentSettings,
  GameShellPlayer,
  GameShellState,
  GuessingChallengeIdentitySecret,
  GuessingChallengeMatchState,
  GuessingChallengePlayerView,
  GuessingChallengeRevealEntry,
  GuessingChallengeRoundState,
  GuessingChallengeVisibleIdentity,
} from '@wanasatna/shared';
import {
  GUESSING_CHALLENGE_DEFAULT_ROUNDS,
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

const MAX_RECENT_IDENTITY_IDS = 32;

export function resolveTotalRounds(settings: GameContentSettings): number {
  return resolveMatchRounds(settings.rounds, GUESSING_CHALLENGE_DEFAULT_ROUNDS);
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

export function getOpponentId(match: GuessingChallengeMatchState, playerId: string): string | null {
  return match.playerIds.find((id) => id !== playerId) ?? null;
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
  playerIds: readonly string[],
  startingPlayerId: string,
  recentIdentityIds: readonly string[],
): GuessingChallengeRoundState {
  const { categoryId, identities } = resolveCategoryPool(roomId);
  const [identityA, identityB] = pickTwoIdentities(identities, recentIdentityIds);

  if (playerIds.length !== 2) {
    throw new Error('Guessing Challenge requires exactly two players.');
  }

  const [playerA, playerB] = playerIds;

  return {
    gamePhase: 'playing',
    phaseRemainingSeconds: 0,
    resolvedCategoryId: categoryId,
    identitiesByPlayerId: {
      [playerA!]: identityA,
      [playerB!]: identityB,
    },
    usedIdentityIds: [identityA.id, identityB.id],
    currentTurnPlayerId: startingPlayerId,
    startingPlayerId,
    cardsByPlayerId: {
      [playerA!]: { yellowUsed: false, redUsed: false },
      [playerB!]: { yellowUsed: false, redUsed: false },
    },
    yellowQuestionsRemaining: null,
    winningPlayerId: null,
    winningGuess: null,
    identityChangedNoticePlayerId: null,
  };
}

export function createMatchState(
  roomId: string,
  players: GameShellPlayer[],
  settings: GameContentSettings,
): GuessingChallengeMatchState {
  if (players.length !== 2) {
    throw new Error('Guessing Challenge requires exactly two players.');
  }

  const playerIds = players.map((player) => player.id);
  const startingPlayerId = playerIds[0]!;
  const round = createRoundState(roomId, playerIds, startingPlayerId, []);

  return {
    playerIds,
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    currentRound: 1,
    totalRounds: resolveTotalRounds(settings),
    scores: createInitialScores(playerIds),
    matchStatus: 'in-progress',
    nextStartingPlayerIndex: 1,
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

export function normalizeGuessInput(guess: string): string | null {
  const trimmed = guess.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > GUESSING_CHALLENGE_MAX_GUESS_LENGTH) {
    return null;
  }
  return trimmed;
}

function passTurn(match: GuessingChallengeMatchState): GuessingChallengeMatchState {
  const remaining = match.round.yellowQuestionsRemaining;

  if (remaining !== null && remaining > 1) {
    return withRound(match, {
      ...match.round,
      yellowQuestionsRemaining: remaining - 1,
      identityChangedNoticePlayerId: null,
    });
  }

  const opponentId = getOpponentId(match, match.round.currentTurnPlayerId);
  if (!opponentId) {
    return match;
  }

  return withRound(match, {
    ...match.round,
    currentTurnPlayerId: opponentId,
    yellowQuestionsRemaining: null,
    identityChangedNoticePlayerId: null,
  });
}

export function endQuestionTurn(
  match: GuessingChallengeMatchState,
  playerId: string,
): { ok: true; match: GuessingChallengeMatchState } | { ok: false; message: string } {
  if (match.round.gamePhase !== 'playing' || match.round.winningPlayerId) {
    return { ok: false, message: 'انتهت هذه الجولة.' };
  }

  if (match.round.currentTurnPlayerId !== playerId) {
    return { ok: false, message: 'ليس دورك الآن' };
  }

  return { ok: true, match: passTurn(match) };
}

export function activateYellowCard(
  match: GuessingChallengeMatchState,
  playerId: string,
): { ok: true; match: GuessingChallengeMatchState } | { ok: false; message: string } {
  if (match.round.gamePhase !== 'playing' || match.round.winningPlayerId) {
    return { ok: false, message: 'انتهت هذه الجولة.' };
  }

  if (match.round.currentTurnPlayerId !== playerId) {
    return { ok: false, message: 'ليس دورك الآن' };
  }

  const cards = match.round.cardsByPlayerId[playerId];
  if (!cards || cards.yellowUsed) {
    return { ok: false, message: 'استخدمت هذه البطاقة بالفعل' };
  }

  if (match.round.yellowQuestionsRemaining !== null) {
    return { ok: false, message: 'البطاقة الصفراء مفعّلة بالفعل' };
  }

  return {
    ok: true,
    match: withRound(match, {
      ...match.round,
      cardsByPlayerId: {
        ...match.round.cardsByPlayerId,
        [playerId]: { ...cards, yellowUsed: true },
      },
      yellowQuestionsRemaining: GUESSING_CHALLENGE_YELLOW_QUESTIONS,
      identityChangedNoticePlayerId: null,
    }),
  };
}

export function activateRedCard(
  match: GuessingChallengeMatchState,
  playerId: string,
): { ok: true; match: GuessingChallengeMatchState } | { ok: false; message: string } {
  if (match.round.gamePhase !== 'playing' || match.round.winningPlayerId) {
    return { ok: false, message: 'انتهت هذه الجولة.' };
  }

  if (match.round.currentTurnPlayerId !== playerId) {
    return { ok: false, message: 'ليس دورك الآن' };
  }

  const cards = match.round.cardsByPlayerId[playerId];
  if (!cards || cards.redUsed) {
    return { ok: false, message: 'استخدمت هذه البطاقة بالفعل' };
  }

  const opponentId = getOpponentId(match, playerId);
  if (!opponentId) {
    return { ok: false, message: 'لا يوجد خصم.' };
  }

  const ownIdentity = match.round.identitiesByPlayerId[playerId];
  const opponentIdentity = match.round.identitiesByPlayerId[opponentId];
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
    match: withRound(match, {
      ...match.round,
      identitiesByPlayerId: {
        ...match.round.identitiesByPlayerId,
        [opponentId]: replacement,
      },
      usedIdentityIds: [...match.round.usedIdentityIds, replacement.id],
      cardsByPlayerId: {
        ...match.round.cardsByPlayerId,
        [playerId]: { ...cards, redUsed: true },
      },
      identityChangedNoticePlayerId: opponentId,
    }),
  };
}

/**
 * Atomic final-guess handling. Correct guess claims winner once.
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

  if (!match || match.round.gamePhase !== 'playing' || match.round.winningPlayerId) {
    return { accepted: false, message: 'انتهت هذه الجولة.', match };
  }

  if (match.round.currentTurnPlayerId !== playerId) {
    return { accepted: false, message: 'ليس دورك الآن', match };
  }

  const normalized = normalizeGuessInput(guess);
  if (!normalized) {
    return { accepted: false, message: 'اكتب تخمينك أولًا', match };
  }

  const ownIdentity = match.round.identitiesByPlayerId[playerId];
  if (!ownIdentity) {
    return { accepted: false, message: 'تعذر التحقق من التخمين.', match };
  }

  if (!identityMatchesGuess(ownIdentity, normalized)) {
    const opponentId = getOpponentId(match, playerId);
    if (!opponentId) {
      return { accepted: false, message: 'لا يوجد خصم.', match };
    }

    // Wrong guess always ends the turn (including any yellow sequence).
    const nextMatch = withRound(match, {
      ...match.round,
      currentTurnPlayerId: opponentId,
      yellowQuestionsRemaining: null,
      identityChangedNoticePlayerId: null,
    });
    setMatch(nextMatch);
    return { accepted: true, correct: false, match: nextMatch };
  }

  const claimed = withRound(match, {
    ...match.round,
    winningPlayerId: playerId,
    winningGuess: normalized,
    yellowQuestionsRemaining: null,
    identityChangedNoticePlayerId: null,
  });
  setMatch(claimed);
  return { accepted: true, correct: true, match: claimed };
}

function buildRevealEntries(match: GuessingChallengeMatchState): GuessingChallengeRevealEntry[] {
  return match.playerIds.map((playerId) => {
    const identity = match.round.identitiesByPlayerId[playerId]!;
    return {
      playerId,
      name: match.playerNames[playerId] ?? 'لاعب',
      identity: toVisibleIdentity(identity),
      isWinner: playerId === match.round.winningPlayerId,
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

export function buildGuessingChallengePlayerView(
  match: GuessingChallengeMatchState,
  playerId: string,
  shell: GameShellState,
): GuessingChallengePlayerView {
  const phase = match.round.gamePhase;
  const revealed = phase === 'round-results' || phase === 'match-completed';
  const isParticipant = match.playerIds.includes(playerId);
  const opponentId = getOpponentId(match, playerId);
  const isMyTurn =
    isParticipant &&
    phase === 'playing' &&
    match.round.currentTurnPlayerId === playerId &&
    !match.round.winningPlayerId;
  const cards = match.round.cardsByPlayerId[playerId] ?? { yellowUsed: true, redUsed: true };
  const ownIdentity = match.round.identitiesByPlayerId[playerId];
  const opponentIdentity = opponentId
    ? match.round.identitiesByPlayerId[opponentId]
    : undefined;

  const turnName = match.playerNames[match.round.currentTurnPlayerId] ?? 'لاعب';

  return {
    gamePhase: phase,
    phaseLabel: `${PHASE_LABELS[phase]} — الجولة ${match.currentRound}/${match.totalRounds}`,
    phaseRemainingSeconds: match.round.phaseRemainingSeconds,
    categoryId: match.round.resolvedCategoryId,
    nextCategoryId: getRoomRoundCategory(shell.roomId) ?? 'random',
    currentRound: match.currentRound,
    totalRounds: match.totalRounds,
    matchStatus: match.matchStatus,
    currentTurnPlayerId: match.round.currentTurnPlayerId,
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
      yellowCardAvailable: !cards.yellowUsed,
      redCardAvailable: !cards.redUsed,
    },
    opponent: {
      playerId: opponentId ?? '',
      name: opponentId ? (match.playerNames[opponentId] ?? 'خصم') : 'خصم',
      visibleIdentity:
        opponentIdentity && (phase === 'playing' || revealed)
          ? toVisibleIdentity(opponentIdentity)
          : null,
    },
    yellowQuestionsRemaining: isMyTurn ? match.round.yellowQuestionsRemaining : null,
    canEndQuestion: isMyTurn,
    canGuess: isMyTurn,
    canUseYellow: isMyTurn && !cards.yellowUsed && match.round.yellowQuestionsRemaining === null,
    canUseRed: isMyTurn && !cards.redUsed,
    identityChangedNotice:
      match.round.identityChangedNoticePlayerId === playerId && phase === 'playing',
    revealEntries: revealed ? buildRevealEntries(match) : [],
    winnerName:
      revealed && match.round.winningPlayerId
        ? (match.playerNames[match.round.winningPlayerId] ?? 'لاعب')
        : null,
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
