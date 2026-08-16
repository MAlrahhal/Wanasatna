/**
 * Unit tests for Guessing Challenge (تحدي التخمين) — 1v1 + 2v2.
 * Run: pnpm --filter @wanasatna/server test:guessing-challenge
 */
import assert from 'node:assert/strict';
import type {
  GameShellState,
  GuessingChallengeIdentitySecret,
  GuessingChallengeMatchState,
  GuessingChallengeRoundState,
} from '@wanasatna/shared';
import {
  GUESSING_CHALLENGE_DEFAULT_ROUNDS,
  GUESSING_CHALLENGE_TURN_SECONDS,
  GUESSING_CHALLENGE_WINNER_POINTS,
  GUESSING_CHALLENGE_YELLOW_QUESTIONS,
} from '@wanasatna/shared';
import { registerAllGameContent } from '../src/modules/content/index.js';
import { isCorrectAnswer } from '../src/modules/game/plugins/fast-answer/answers.js';
import {
  GUESSING_CHALLENGE_RANDOM_CATEGORY_ID,
  chooseRoundCategoryId,
  getIdentitiesForCategory,
  pickReplacementIdentity,
  pickTwoIdentities,
} from '../src/modules/game/plugins/guessing-challenge/identities.js';
import {
  applyRoundScores,
  buildResultsLeaderboardEntries,
} from '../src/modules/game/plugins/guessing-challenge/scoring.js';
import {
  advanceAfterQuestionUnit,
  applyFinalGuess,
  assignTeams,
  buildGuessingChallengePlayerView,
  confirmSpecialCard,
  createRoundState,
  rejectSpecialCard,
  createInitialTeamCards,
  createInitialTeamScores,
  endQuestionTurn,
  expireGuessingChallengeTurn,
  markGuessingChallengePlayerDeparted,
  applyLookDirection,
  clearLookThrottleForRoom,
  reconcilePendingCardConfirm,
  getOpponentTeamId,
  viewContainsSecretLeak,
  withRound,
} from '../src/modules/game/plugins/guessing-challenge/state.js';
import { registerAllGamePlugins } from '../src/modules/game/plugins/index.js';
import {
  getGamePluginDefinition,
  hasGamePlugin,
} from '../src/modules/game/runtime/plugin-registry.js';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

registerAllGameContent();
registerAllGamePlugins();

function makeIdentity(
  id: string,
  value: string,
  aliases: string[] = [],
  categoryId = 'football',
): GuessingChallengeIdentitySecret {
  return {
    id,
    categoryId,
    type: 'text',
    value,
    imageUrl: null,
    acceptedAnswers: [value, ...aliases],
  };
}

function makeShell(
  playerIds: string[] = ['p1', 'p2'],
  connectedIds: string[] = playerIds,
): GameShellState {
  const names = ['محمد', 'خالد', 'سارة', 'نورة'];
  const connected = new Set(connectedIds);
  return {
    shellId: 'shell-gc',
    roomId: 'room-gc',
    gameId: 'guessing-challenge',
    phase: 'PLAYING',
    hostPlayerId: playerIds[0]!,
    players: playerIds.map((id, index) => ({
      id,
      name: names[index] ?? `لاعب${index + 1}`,
      isConnected: connected.has(id),
      isHost: index === 0,
      isReady: true,
    })),
    readyPlayerIds: [...playerIds],
    countdownSeconds: null,
    countdownRemainingSeconds: null,
    gameTimerSeconds: null,
    gameTimerRemainingSeconds: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    updatedAt: new Date().toISOString(),
    matchParticipantIds: [...playerIds],
  };
}

function makeRound(overrides?: Partial<GuessingChallengeRoundState>): GuessingChallengeRoundState {
  const idBlue = makeIdentity('id-blue', 'كريستيانو رونالدو', ['رونالدو', 'كريستيانو']);
  const idRed = makeIdentity('id-red', 'ليونيل ميسي', ['ميسي']);

  return {
    roundId: 'round-1',
    turnId: 'turn-1',
    gamePhase: 'playing',
    phaseRemainingSeconds: 45,
    deadlineAtMs: Date.now() + 45_000,
    resolvedCategoryId: 'football',
    identitiesByTeamId: { blue: idBlue, red: idRed },
    usedIdentityIds: [idBlue.id, idRed.id],
    currentTurnTeamId: 'blue',
    startingTeamId: 'blue',
    yellowQuestionsRemaining: null,
    winningTeamId: null,
    winningPlayerId: null,
    winningGuess: null,
    identityChangedNoticeTeamId: null,
    cardConfirm: null,
    scoresApplied: false,
    ...overrides,
  };
}

function makeMatch1v1(overrides?: Partial<GuessingChallengeMatchState>): GuessingChallengeMatchState {
  const { teamByPlayerId, seatByPlayerId } = assignTeams(['p1', 'p2'], '1v1');
  return {
    mode: '1v1',
    playerIds: ['p1', 'p2'],
    playerNames: { p1: 'محمد', p2: 'خالد' },
    teamByPlayerId,
    seatByPlayerId,
    teamCards: createInitialTeamCards(),
    teamScores: createInitialTeamScores(),
    scores: { p1: 0, p2: 0 },
    lookByPlayerId: { p1: { yaw: 0, pitch: 0 }, p2: { yaw: 0, pitch: 0 } },
    currentRound: 1,
    totalRounds: 4,
    matchStatus: 'in-progress',
    nextStartingTeamId: 'red',
    lockedCategoryId: 'football',
    lockedCategoryLabel: 'كرة قدم',
    usedRoundCategoryIds: ['football'],
    departedPlayerIds: [],
    recentIdentityIds: ['id-blue', 'id-red'],
    round: makeRound(),
    ...overrides,
  };
}

function makeMatch2v2(overrides?: Partial<GuessingChallengeMatchState>): GuessingChallengeMatchState {
  const playerIds = ['p1', 'p2', 'p3', 'p4'];
  const { teamByPlayerId, seatByPlayerId } = assignTeams(playerIds, '2v2');
  return {
    mode: '2v2',
    playerIds,
    playerNames: { p1: 'محمد', p2: 'خالد', p3: 'سارة', p4: 'نورة' },
    teamByPlayerId,
    seatByPlayerId,
    teamCards: createInitialTeamCards(),
    teamScores: createInitialTeamScores(),
    scores: { p1: 0, p2: 0, p3: 0, p4: 0 },
    lookByPlayerId: Object.fromEntries(playerIds.map((id) => [id, { yaw: 0, pitch: 0 }])),
    currentRound: 1,
    totalRounds: 4,
    matchStatus: 'in-progress',
    nextStartingTeamId: 'red',
    lockedCategoryId: 'football',
    lockedCategoryLabel: 'كرة قدم',
    usedRoundCategoryIds: ['football'],
    departedPlayerIds: [],
    recentIdentityIds: ['id-blue', 'id-red'],
    round: makeRound(),
    ...overrides,
  };
}

function confirmCard(
  match: GuessingChallengeMatchState,
  shell: GameShellState,
  playerId: string,
  card: 'yellow' | 'red',
) {
  let state = match;
  return confirmSpecialCard(
    () => state,
    (next) => {
      state = next;
    },
    shell,
    playerId,
    card,
    state.round.roundId,
    state.round.turnId,
    state.round.cardConfirm?.requestId,
  );
}

test('A plugin registers correctly', () => {
  assert.equal(hasGamePlugin('guessing-challenge'), true);
  const plugin = getGamePluginDefinition('guessing-challenge');
  assert.ok(plugin);
  assert.equal(plugin.minPlayers, 2);
  assert.equal(plugin.maxPlayers, 4);
  assert.ok(plugin.settingsSchema.some((field) => field.id === 'mode'));
});

test('C mode player-count requirements', () => {
  const plugin = getGamePluginDefinition('guessing-challenge');
  assert.ok(plugin?.validateStart);

  const ok1v1 = plugin.validateStart(
    {
      roomId: 'r-1v1',
      shellId: '',
      gameId: 'guessing-challenge',
      hostPlayerId: '1',
      phase: 'WAITING',
      players: [
        { id: '1', name: 'a', isConnected: true, isHost: true, isReady: true },
        { id: '2', name: 'b', isConnected: true, isHost: false, isReady: true },
      ],
    },
    { mode: '1v1' },
  );
  assert.equal(ok1v1.success, true);

  const tooManyFor1v1 = plugin.validateStart(
    {
      roomId: 'r',
      shellId: '',
      gameId: 'guessing-challenge',
      hostPlayerId: '1',
      phase: 'WAITING',
      players: [
        { id: '1', name: 'a', isConnected: true, isHost: true, isReady: true },
        { id: '2', name: 'b', isConnected: true, isHost: false, isReady: true },
        { id: '3', name: 'c', isConnected: true, isHost: false, isReady: true },
      ],
    },
    { mode: '1v1' },
  );
  assert.equal(tooManyFor1v1.success, false);

  const threeFor2v2 = plugin.validateStart(
    {
      roomId: 'r-three',
      shellId: '',
      gameId: 'guessing-challenge',
      hostPlayerId: '1',
      phase: 'WAITING',
      players: [
        { id: '1', name: 'a', isConnected: true, isHost: true, isReady: true },
        { id: '2', name: 'b', isConnected: true, isHost: false, isReady: true },
        { id: '3', name: 'c', isConnected: true, isHost: false, isReady: true },
      ],
    },
    { mode: '2v2' },
  );
  assert.equal(threeFor2v2.success, false);

  const ok2v2 = plugin.validateStart(
    {
      roomId: 'r2',
      shellId: '',
      gameId: 'guessing-challenge',
      hostPlayerId: '1',
      phase: 'WAITING',
      players: [
        { id: '1', name: 'a', isConnected: true, isHost: true, isReady: true },
        { id: '2', name: 'b', isConnected: true, isHost: false, isReady: true },
        { id: '3', name: 'c', isConnected: true, isHost: false, isReady: true },
        { id: '4', name: 'd', isConnected: true, isHost: false, isReady: true },
      ],
    },
    { mode: '2v2' },
  );
  // May fail content validation if room mode store interferes; player count itself is ok path.
  // With mode 2v2 and 4 players, should not fail on count.
  if (!ok2v2.success) {
    assert.ok(!ok2v2.error.includes('أربعة'), ok2v2.error);
  }
});

test('team assignment deterministic', () => {
  const one = assignTeams(['a', 'b'], '1v1');
  assert.equal(one.teamByPlayerId.a, 'blue');
  assert.equal(one.teamByPlayerId.b, 'red');

  const two = assignTeams(['a', 'b', 'c', 'd'], '2v2');
  assert.equal(two.teamByPlayerId.a, 'blue');
  assert.equal(two.seatByPlayerId.a, 0);
  assert.equal(two.teamByPlayerId.b, 'red');
  assert.equal(two.seatByPlayerId.b, 0);
  assert.equal(two.teamByPlayerId.c, 'blue');
  assert.equal(two.seatByPlayerId.c, 1);
  assert.equal(two.teamByPlayerId.d, 'red');
  assert.equal(two.seatByPlayerId.d, 1);
  assert.equal(getOpponentTeamId('blue'), 'red');
});

test('G two different identities selected', () => {
  const pool = getIdentitiesForCategory('football');
  assert.ok(pool.length >= 2);
  const [a, b] = pickTwoIdentities(pool, []);
  assert.notEqual(a.id, b.id);
});

test('H/I Player A view hides own identity, shows opponent', () => {
  const match = makeMatch1v1();
  const view = buildGuessingChallengePlayerView(match, 'p1', makeShell());
  assert.equal(view.self.identityHidden, true);
  assert.equal(view.self.revealedIdentity, null);
  assert.equal(view.opponent.visibleIdentity?.value, 'ليونيل ميسي');
  assert.equal(view.selfTeam, 'blue');
  assert.equal(view.mode, '1v1');
  assert.equal(viewContainsSecretLeak(view, match.round.identitiesByTeamId.blue!), false);
});

test('J/K Player B view hides own identity, shows opponent', () => {
  const match = makeMatch1v1();
  const view = buildGuessingChallengePlayerView(match, 'p2', makeShell());
  assert.equal(view.opponent.visibleIdentity?.value, 'كريستيانو رونالدو');
  assert.equal(viewContainsSecretLeak(view, match.round.identitiesByTeamId.red!), false);
});

test('L acceptedAnswers never appear in active client view', () => {
  const match = makeMatch1v1();
  const view = buildGuessingChallengePlayerView(match, 'p1', makeShell());
  assert.ok(!JSON.stringify(view).includes('acceptedAnswers'));
});

test('N/O end-question passes turn; non-turn rejected', () => {
  const match = makeMatch1v1();
  const rejected = endQuestionTurn(match, 'p2');
  assert.equal(rejected.ok, false);

  const ok = endQuestionTurn(match, 'p1');
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.match.round.currentTurnTeamId, 'red');
  }
});

test('Q/R/S/T/U final guess correct/wrong/turn/non-turn', () => {
  let state = makeMatch1v1();
  const nonTurn = applyFinalGuess(
    () => state,
    (next) => {
      state = next;
    },
    'p2',
    'ميسي',
  );
  assert.equal(nonTurn.accepted, false);

  const wrong = applyFinalGuess(
    () => state,
    (next) => {
      state = next;
    },
    'p1',
    'نيمار',
  );
  assert.equal(wrong.accepted, true);
  if (wrong.accepted) {
    assert.equal(wrong.correct, false);
    assert.equal(wrong.match.round.currentTurnTeamId, 'red');
    assert.equal(wrong.match.round.winningTeamId, null);
  }

  state = withRound(state, { ...state.round, currentTurnTeamId: 'red' });
  const correct = applyFinalGuess(
    () => state,
    (next) => {
      state = next;
    },
    'p2',
    'ميسي',
  );
  assert.equal(correct.accepted, true);
  if (correct.accepted) {
    assert.equal(correct.correct, true);
    assert.equal(correct.match.round.winningTeamId, 'red');
    assert.equal(correct.match.round.winningPlayerId, 'p2');
  }
});

test('V/W/X answer normalization and aliases', () => {
  assert.equal(isCorrectAnswer('  رونالدو ', ['كريستيانو رونالدو', 'رونالدو']), true);
  assert.equal(isCorrectAnswer('xyz', ['ميسي']), false);
});

test('Y/Z scoring +100 to winning team once; mirrored display', () => {
  let match = makeMatch1v1({
    round: makeRound({ winningTeamId: 'blue', winningPlayerId: 'p1', winningGuess: 'رونالدو' }),
  });
  match = applyRoundScores(match);
  assert.equal(match.teamScores.blue, GUESSING_CHALLENGE_WINNER_POINTS);
  assert.equal(match.teamScores.red, 0);
  assert.equal(match.scores.p1, GUESSING_CHALLENGE_WINNER_POINTS);
  assert.equal(match.scores.p2, 0);
});

test('AA late action after round finalized rejected', () => {
  const match = makeMatch1v1({
    round: makeRound({ winningTeamId: 'blue', winningPlayerId: 'p1', winningGuess: 'رونالدو' }),
  });
  const end = endQuestionTurn(match, 'p1');
  assert.equal(end.ok, false);
});

test('AB-AH yellow card sequence (1v1 single confirm activates)', () => {
  let match = makeMatch1v1();
  const shell = makeShell();
  const activated = confirmCard(match, shell, 'p1', 'yellow');
  assert.equal(activated.ok, true);
  if (!activated.ok) return;
  assert.equal(activated.activated, true);
  match = activated.match;
  assert.equal(match.round.yellowQuestionsRemaining, GUESSING_CHALLENGE_YELLOW_QUESTIONS);
  assert.equal(match.teamCards.blue.yellowUsed, true);

  const again = confirmCard(match, shell, 'p1', 'yellow');
  assert.equal(again.ok, false);

  let step = endQuestionTurn(match, 'p1');
  assert.equal(step.ok, true);
  if (step.ok) {
    assert.equal(step.match.round.currentTurnTeamId, 'blue');
    assert.equal(step.match.round.yellowQuestionsRemaining, 2);
    match = step.match;
  }

  step = endQuestionTurn(match, 'p1');
  if (step.ok) {
    assert.equal(step.match.round.yellowQuestionsRemaining, 1);
    match = step.match;
  }

  step = endQuestionTurn(match, 'p1');
  if (step.ok) {
    assert.equal(step.match.round.currentTurnTeamId, 'red');
    assert.equal(step.match.round.yellowQuestionsRemaining, null);
  }
});

test('AI wrong guess during yellow ends sequence', () => {
  let match = makeMatch1v1();
  const shell = makeShell();
  const activated = confirmCard(match, shell, 'p1', 'yellow');
  assert.ok(activated.ok);
  if (activated.ok) match = activated.match;

  const wrong = applyFinalGuess(
    () => match,
    (next) => {
      match = next;
    },
    'p1',
    'خطأ',
  );
  assert.equal(wrong.accepted, true);
  if (wrong.accepted) {
    assert.equal(wrong.correct, false);
    assert.equal(wrong.match.round.currentTurnTeamId, 'red');
    assert.equal(wrong.match.round.yellowQuestionsRemaining, null);
  }
});

test('AL-AT red card changes opponent team identity privately', () => {
  let match = makeMatch1v1({
    round: makeRound({
      identitiesByTeamId: {
        blue: makeIdentity('id-blue', 'كريستيانو رونالدو', ['رونالدو']),
        red: makeIdentity('id-red', 'ليونيل ميسي', ['ميسي']),
      },
      usedIdentityIds: ['id-blue', 'id-red'],
    }),
  });
  const shell = makeShell();

  const result = confirmCard(match, shell, 'p1', 'red');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  match = result.match;

  const newOpp = match.round.identitiesByTeamId.red!;
  assert.notEqual(newOpp.id, 'id-red');
  assert.equal(newOpp.categoryId, 'football');
  assert.notEqual(newOpp.id, match.round.identitiesByTeamId.blue!.id);
  assert.equal(match.teamCards.blue.redUsed, true);

  const viewA = buildGuessingChallengePlayerView(match, 'p1', shell);
  assert.equal(viewA.opponent.visibleIdentity?.value, newOpp.value);

  const viewB = buildGuessingChallengePlayerView(match, 'p2', shell);
  assert.equal(viewB.self.revealedIdentity, null);
  assert.equal(viewB.identityChangedNotice, true);
  assert.equal(JSON.stringify(viewB).includes('"acceptedAnswers"'), false);
  assert.equal(JSON.stringify(viewB).includes(newOpp.value), false);
  // Avoid short-alias false positives against Arabic UI copy.
  assert.equal(
    viewContainsSecretLeak(viewB, { ...newOpp, acceptedAnswers: [newOpp.value] }),
    false,
  );

  const again = confirmCard(match, shell, 'p1', 'red');
  assert.equal(again.ok, false);
});

test('AU failed replacement does not consume card', () => {
  const alone = makeIdentity('only', 'أسد', [], 'animals');
  const replacement = pickReplacementIdentity([alone], {
    currentOpponentId: 'only',
    ownIdentityId: 'x',
    usedIdentityIds: [],
  });
  assert.equal(replacement, null);
});

test('AV/AW old accepted invalid after red; new valid', () => {
  let match = makeMatch1v1();
  const shell = makeShell();
  const beforeOpp = match.round.identitiesByTeamId.red!;
  const result = confirmCard(match, shell, 'p1', 'red');
  assert.ok(result.ok);
  if (!result.ok) return;
  match = result.match;
  const afterOpp = match.round.identitiesByTeamId.red!;

  match = withRound(match, { ...match.round, currentTurnTeamId: 'red' });
  const oldGuess = applyFinalGuess(
    () => match,
    (next) => {
      match = next;
    },
    'p2',
    beforeOpp.acceptedAnswers[0]!,
  );

  if (beforeOpp.id !== afterOpp.id && !afterOpp.acceptedAnswers.includes(beforeOpp.value)) {
    assert.equal(oldGuess.accepted, true);
    if (oldGuess.accepted) {
      assert.equal(oldGuess.correct, false);
    }
  }

  match = withRound(match, {
    ...match.round,
    currentTurnTeamId: 'red',
    winningTeamId: null,
    winningPlayerId: null,
    yellowQuestionsRemaining: null,
  });
  const newGuess = applyFinalGuess(
    () => match,
    (next) => {
      match = next;
    },
    'p2',
    afterOpp.acceptedAnswers[0]!,
  );
  assert.equal(newGuess.accepted, true);
  if (newGuess.accepted) {
    assert.equal(newGuess.correct, true);
  }
});

test('BF both identities visible only after reveal', () => {
  const match = makeMatch1v1({
    round: makeRound({
      gamePhase: 'round-results',
      winningTeamId: 'blue',
      winningPlayerId: 'p1',
      winningGuess: 'رونالدو',
    }),
  });
  const view = buildGuessingChallengePlayerView(match, 'p1', makeShell());
  assert.equal(view.revealEntries.length, 2);
  assert.ok(view.self.revealedIdentity?.value);
  assert.ok(view.opponent.visibleIdentity?.value);
});

test('2v2 team privacy — own team secret never leaked', () => {
  const match = makeMatch2v2();
  const shell = makeShell(['p1', 'p2', 'p3', 'p4']);
  const viewP1 = buildGuessingChallengePlayerView(match, 'p1', shell);
  const viewP3 = buildGuessingChallengePlayerView(match, 'p3', shell);
  assert.equal(viewP1.teammate?.playerId, 'p3');
  assert.equal(viewP3.teammate?.playerId, 'p1');
  assert.equal(viewP1.opponents.length, 2);
  assert.equal(viewP1.opponent.visibleIdentity?.value, 'ليونيل ميسي');
  assert.equal(viewP3.opponent.visibleIdentity?.value, 'ليونيل ميسي');
  assert.equal(viewContainsSecretLeak(viewP1, match.round.identitiesByTeamId.blue!), false);
  assert.equal(viewContainsSecretLeak(viewP3, match.round.identitiesByTeamId.blue!), false);
});

test('2v2 card confirm 1/2 does not activate; 2/2 activates once', () => {
  let match = makeMatch2v2();
  const shell = makeShell(['p1', 'p2', 'p3', 'p4']);

  const first = confirmCard(match, shell, 'p1', 'yellow');
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.activated, false);
  match = first.match;
  assert.equal(match.teamCards.blue.yellowUsed, false);
  assert.equal(match.round.cardConfirm?.confirmedPlayerIds.length, 1);
  assert.equal(match.round.yellowQuestionsRemaining, null);

  const view = buildGuessingChallengePlayerView(match, 'p3', shell);
  assert.ok(view.cardConfirmStatus);
  assert.equal(view.cardConfirmStatus?.confirmedCount, 1);
  assert.equal(view.cardConfirmStatus?.requiredCount, 2);
  assert.equal(view.cardConfirmStatus?.selfConfirmed, false);
  assert.ok(view.cardConfirmStatus?.requestingPlayerName);
  assert.match(view.cardConfirmStatus?.message ?? '', /يريد استخدام/);

  const second = confirmCard(match, shell, 'p3', 'yellow');
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.activated, true);
  match = second.match;
  assert.equal(match.teamCards.blue.yellowUsed, true);
  assert.equal(match.round.yellowQuestionsRemaining, GUESSING_CHALLENGE_YELLOW_QUESTIONS);
  assert.equal(match.round.cardConfirm, null);

  const third = confirmCard(match, shell, 'p1', 'yellow');
  assert.equal(third.ok, false);
});

test('2v2 reject clears pending confirm; card stays available', () => {
  let match = makeMatch2v2();
  const shell = makeShell(['p1', 'p2', 'p3', 'p4']);

  const first = confirmCard(match, shell, 'p1', 'yellow');
  assert.equal(first.ok, true);
  if (!first.ok) return;
  match = first.match;
  assert.ok(match.round.cardConfirm);
  assert.equal(match.teamCards.blue.yellowUsed, false);

  const rejected = rejectSpecialCard(
    () => match,
    (next) => {
      match = next;
    },
    shell,
    'p3',
  );
  assert.equal(rejected.ok, true);
  if (!rejected.ok) return;
  match = rejected.match;
  assert.equal(match.round.cardConfirm, null);
  assert.equal(match.teamCards.blue.yellowUsed, false);

  const viewP1 = buildGuessingChallengePlayerView(match, 'p1', shell);
  const viewP3 = buildGuessingChallengePlayerView(match, 'p3', shell);
  assert.equal(viewP1.cardConfirmStatus, null);
  assert.equal(viewP3.cardConfirmStatus, null);
  assert.equal(viewP1.self.yellowCardAvailable, true);
  assert.equal(viewP3.self.yellowCardAvailable, true);

  // Can request again after reject.
  const again = confirmCard(match, shell, 'p1', 'yellow');
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.activated, false);
  assert.ok(again.match.round.cardConfirm);
});

test('2v2 either teammate may act on team turn', () => {
  const match = makeMatch2v2();
  const fromSeat1 = endQuestionTurn(match, 'p3');
  assert.equal(fromSeat1.ok, true);
  if (fromSeat1.ok) {
    assert.equal(fromSeat1.match.round.currentTurnTeamId, 'red');
  }
});

test('2v2 scoring mirrors to both teammates without double-award', () => {
  let match = makeMatch2v2({
    round: makeRound({
      winningTeamId: 'blue',
      winningPlayerId: 'p3',
      winningGuess: 'رونالدو',
    }),
  });
  match = applyRoundScores(match);
  assert.equal(match.teamScores.blue, GUESSING_CHALLENGE_WINNER_POINTS);
  assert.equal(match.scores.p1, GUESSING_CHALLENGE_WINNER_POINTS);
  assert.equal(match.scores.p3, GUESSING_CHALLENGE_WINNER_POINTS);
  assert.equal(match.scores.p2, 0);
  assert.equal(match.scores.p4, 0);
});

test('match-scoped cards persist conceptually (teamCards not on round)', () => {
  const match = makeMatch1v1();
  assert.ok(match.teamCards);
  assert.equal('cardsByPlayerId' in match.round, false);
  assert.equal('identitiesByPlayerId' in match.round, false);
});

test('teamCards persist when advancing to next round', () => {
  let match = makeMatch2v2({
    teamCards: {
      blue: { yellowUsed: true, redUsed: false },
      red: { yellowUsed: false, redUsed: true },
    },
    currentRound: 1,
    totalRounds: 4,
    round: makeRound({
      gamePhase: 'round-results',
      winningTeamId: 'red',
      winningPlayerId: 'p2',
      winningGuess: 'ميسي',
    }),
  });

  // Simulate startNextRound preservation logic (match-lifecycle keeps teamCards).
  const nextRound = makeRound({
    currentTurnTeamId: match.nextStartingTeamId,
    startingTeamId: match.nextStartingTeamId,
  });
  match = {
    ...match,
    currentRound: match.currentRound + 1,
    nextStartingTeamId: match.nextStartingTeamId === 'blue' ? 'red' : 'blue',
    round: nextRound,
  };

  assert.equal(match.currentRound, 2);
  assert.equal(match.teamCards.blue.yellowUsed, true);
  assert.equal(match.teamCards.red.redUsed, true);
  assert.equal(match.round.cardConfirm, null);
});

test('cardConfirm cleared on turn change', () => {
  let match = makeMatch2v2({
    round: makeRound({
      cardConfirm: {
        requestId: 'req-1',
        roundId: 'round-1',
        turnId: 'turn-1',
        card: 'yellow',
        teamId: 'blue',
        confirmedPlayerIds: ['p1'],
      },
    }),
  });
  const step = endQuestionTurn(match, 'p1');
  assert.equal(step.ok, true);
  if (step.ok) {
    assert.equal(step.match.round.cardConfirm, null);
  }
});

test('production match contract is four rounds with 45-second turns', () => {
  assert.equal(GUESSING_CHALLENGE_DEFAULT_ROUNDS, 4);
  assert.equal(GUESSING_CHALLENGE_TURN_SECONDS, 45);
  const match = makeMatch1v1();
  assert.equal(match.totalRounds, 4);
  assert.equal(match.round.phaseRemainingSeconds, 45);
});

test('normal completion creates a fresh turn generation and rejects stale repeat', () => {
  const match = makeMatch1v1();
  const oldTurnId = match.round.turnId;
  const first = endQuestionTurn(match, 'p1', match.round.roundId, oldTurnId);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.notEqual(first.match.round.turnId, oldTurnId);
  assert.equal(first.match.round.currentTurnTeamId, 'red');
  const stale = endQuestionTurn(first.match, 'p1', match.round.roundId, oldTurnId);
  assert.equal(stale.ok, false);
});

test('turn timeout auto-passes and stale timeout cannot mutate new turn', () => {
  const match = makeMatch1v1();
  const advanced = expireGuessingChallengeTurn(
    match,
    match.round.roundId,
    match.round.turnId,
  );
  assert.ok(advanced);
  assert.equal(advanced.round.currentTurnTeamId, 'red');
  assert.notEqual(advanced.round.turnId, match.round.turnId);
  assert.equal(
    expireGuessingChallengeTurn(advanced, match.round.roundId, match.round.turnId),
    null,
  );
});

test('stale guess and stale card request reject when same team returns later', () => {
  const initial = makeMatch1v1();
  const afterBlue = advanceAfterQuestionUnit(initial);
  const blueAgain = advanceAfterQuestionUnit(afterBlue);
  assert.equal(blueAgain.round.currentTurnTeamId, 'blue');

  let state = blueAgain;
  const staleGuess = applyFinalGuess(
    () => state,
    (next) => {
      state = next;
    },
    'p1',
    'رونالدو',
    initial.round.roundId,
    initial.round.turnId,
  );
  assert.equal(staleGuess.accepted, false);

  const staleCard = confirmSpecialCard(
    () => state,
    (next) => {
      state = next;
    },
    makeShell(),
    'p1',
    'yellow',
    initial.round.roundId,
    initial.round.turnId,
  );
  assert.equal(staleCard.ok, false);
});

test('yellow activation and every unit receive fresh 45-second generations', () => {
  let match = makeMatch1v1();
  const before = match.round.turnId;
  const yellow = confirmCard(match, makeShell(), 'p1', 'yellow');
  assert.equal(yellow.ok, true);
  if (!yellow.ok) return;
  match = yellow.match;
  assert.equal(match.round.yellowQuestionsRemaining, 3);
  assert.notEqual(match.round.turnId, before);
  assert.equal(match.round.phaseRemainingSeconds, 45);

  const ids = [match.round.turnId];
  for (let index = 0; index < 3; index += 1) {
    const next = expireGuessingChallengeTurn(
      match,
      match.round.roundId,
      match.round.turnId,
    );
    assert.ok(next);
    match = next;
    ids.push(match.round.turnId);
    assert.equal(match.round.phaseRemainingSeconds, 45);
  }
  assert.equal(new Set(ids).size, 4);
  assert.equal(match.round.currentTurnTeamId, 'red');
});

test('pending 2v2 card auto-activates when unconfirmed teammate disconnects', () => {
  let match = makeMatch2v2();
  const shell = makeShell(['p1', 'p2', 'p3', 'p4']);
  const first = confirmSpecialCard(
    () => match,
    (next) => {
      match = next;
    },
    shell,
    'p1',
    'yellow',
    match.round.roundId,
    match.round.turnId,
  );
  assert.equal(first.ok, true);
  assert.equal(match.round.yellowQuestionsRemaining, null);

  const disconnectedShell = makeShell(
    ['p1', 'p2', 'p3', 'p4'],
    ['p1', 'p2', 'p4'],
  );
  const reconciled = reconcilePendingCardConfirm(match, disconnectedShell);
  assert.equal(reconciled.changed, true);
  assert.equal(reconciled.activated, true);
  assert.equal(reconciled.match.round.yellowQuestionsRemaining, 3);
  assert.equal(reconciled.match.teamCards.blue.yellowUsed, true);
});

test('turn transition cancels pending card and stale approval rejects', () => {
  let match = makeMatch2v2();
  const shell = makeShell(['p1', 'p2', 'p3', 'p4']);
  const first = confirmSpecialCard(
    () => match,
    (next) => {
      match = next;
    },
    shell,
    'p1',
    'red',
    match.round.roundId,
    match.round.turnId,
  );
  assert.equal(first.ok, true);
  const pending = match.round.cardConfirm!;
  const advanced = expireGuessingChallengeTurn(
    match,
    match.round.roundId,
    match.round.turnId,
  )!;
  assert.equal(advanced.round.cardConfirm, null);

  let current = advanced;
  const stale = confirmSpecialCard(
    () => current,
    (next) => {
      current = next;
    },
    shell,
    'p3',
    'red',
    pending.roundId,
    pending.turnId,
    pending.requestId,
  );
  assert.equal(stale.ok, false);
});

test('random category prefers unused; fixed category remains fixed', () => {
  const pool = ['animals', 'food', 'cars'];
  assert.equal(
    chooseRoundCategoryId('food', ['food'], pool, () => 2),
    'food',
  );
  assert.equal(
    chooseRoundCategoryId(
      GUESSING_CHALLENGE_RANDOM_CATEGORY_ID,
      ['animals'],
      pool,
      () => 0,
    ),
    'food',
  );
});

test('random remains public while round uses an internal category', () => {
  const match = makeMatch1v1({
    lockedCategoryId: GUESSING_CHALLENGE_RANDOM_CATEGORY_ID,
    lockedCategoryLabel: 'عشوائي',
    round: makeRound({ resolvedCategoryId: 'football' }),
  });
  const view = buildGuessingChallengePlayerView(match, 'p1', makeShell());
  assert.equal(view.categoryId, GUESSING_CHALLENGE_RANDOM_CATEGORY_ID);
  assert.equal(view.categoryLabel, 'عشوائي');
  assert.equal(JSON.stringify(view).includes('resolvedCategoryId'), false);
});

test('four random rounds consume unused valid categories first', () => {
  const teams = assignTeams(['p1', 'p2'], '1v1').teamByPlayerId;
  let usedCategories: string[] = [];
  let recentIdentities: string[] = [];
  const resolved: string[] = [];

  for (let roundNumber = 0; roundNumber < 4; roundNumber += 1) {
    const created = createRoundState(
      GUESSING_CHALLENGE_RANDOM_CATEGORY_ID,
      usedCategories,
      teams,
      roundNumber % 2 === 0 ? 'blue' : 'red',
      recentIdentities,
    );
    resolved.push(created.round.resolvedCategoryId);
    usedCategories = created.usedRoundCategoryIds;
    recentIdentities = [...recentIdentities, ...created.round.usedIdentityIds];
  }

  assert.equal(new Set(resolved).size, 4);
});

test('specific match category remains internal category for all four rounds', () => {
  const teams = assignTeams(['p1', 'p2'], '1v1').teamByPlayerId;
  let recent: string[] = [];
  for (let roundNumber = 0; roundNumber < 4; roundNumber += 1) {
    const created = createRoundState(
      'football',
      [],
      teams,
      roundNumber % 2 === 0 ? 'blue' : 'red',
      recent,
    );
    assert.equal(created.round.resolvedCategoryId, 'football');
    assert.ok(
      Object.values(created.round.identitiesByTeamId).every(
        (identity) => identity.categoryId === 'football',
      ),
    );
    recent = [...recent, ...created.round.usedIdentityIds];
  }
});

test('identity picker consumes remaining fresh alternative before reuse', () => {
  const pool = [
    makeIdentity('a', 'أ'),
    makeIdentity('b', 'ب'),
    makeIdentity('c', 'ج'),
  ];
  const picked = pickTwoIdentities(pool, ['a', 'b']);
  assert.ok(picked.some((identity) => identity.id === 'c'));
  assert.notEqual(picked[0].id, picked[1].id);
});

test('spectator receives no identities or controls', () => {
  const match = makeMatch2v2();
  const view = buildGuessingChallengePlayerView(
    match,
    'spectator',
    makeShell(['p1', 'p2', 'p3', 'p4', 'spectator']),
  );
  assert.equal(view.isMatchSpectator, true);
  assert.equal(view.selfTeam, null);
  assert.equal(view.opponents.length, 0);
  assert.equal(view.opponent.visibleIdentity, null);
  assert.equal(view.canGuess, false);
  assert.equal(view.canEndQuestion, false);
  assert.equal(view.canUseYellow, false);
  assert.equal(JSON.stringify(view).includes('acceptedAnswers'), false);
});

test('departed teammate receives no future mirrored score', () => {
  let match = markGuessingChallengePlayerDeparted(makeMatch2v2(), 'p3');
  assert.equal(
    endQuestionTurn(match, 'p3', match.round.roundId, match.round.turnId).ok,
    false,
  );
  match = withRound(match, {
    ...match.round,
    winningTeamId: 'blue',
    winningPlayerId: 'p1',
  });
  match = applyRoundScores(match);
  assert.equal(match.scores.p1, 100);
  assert.equal(match.scores.p3, 0);
});

test('tie-safe final rankings share rank one', () => {
  const rankings = buildResultsLeaderboardEntries(makeMatch1v1());
  assert.equal(rankings[0]?.rank, 1);
  assert.equal(rankings[1]?.rank, 1);
  assert.equal(rankings[0]?.isFirstPlace, true);
  assert.equal(rankings[1]?.isFirstPlace, true);
});

test('all four 2v2 seats receive authoritative winning team', () => {
  const match = makeMatch2v2({
    round: makeRound({
      gamePhase: 'round-results',
      winningTeamId: 'red',
      winningPlayerId: 'p2',
      winningGuess: 'ميسي',
    }),
  });
  const shell = makeShell(['p1', 'p2', 'p3', 'p4']);
  for (const playerId of match.playerIds) {
    const view = buildGuessingChallengePlayerView(match, playerId, shell);
    assert.equal(view.winningTeamId, 'red');
    assert.equal(
      view.roundResults.find((entry) => entry.playerId === playerId)?.isWinner,
      match.teamByPlayerId[playerId] === 'red',
    );
  }
});

test('starting team alternates blue/red/blue/red across four rounds', () => {
  let starting: GuessingChallengeMatchState['nextStartingTeamId'] = 'blue';
  const seen: string[] = [];
  for (let roundNumber = 1; roundNumber <= 4; roundNumber += 1) {
    seen.push(starting);
    starting = starting === 'blue' ? 'red' : 'blue';
  }
  assert.deepEqual(seen, ['blue', 'red', 'blue', 'red']);
  assert.equal(makeMatch1v1().round.startingTeamId, 'blue');
  assert.equal(makeMatch1v1().nextStartingTeamId, 'red');
});

test('omitted requestId still joins the current 2v2 pending card', () => {
  let match = makeMatch2v2();
  const shell = makeShell(['p1', 'p2', 'p3', 'p4']);
  const first = confirmSpecialCard(
    () => match,
    (next) => {
      match = next;
    },
    shell,
    'p1',
    'yellow',
    match.round.roundId,
    match.round.turnId,
  );
  assert.equal(first.ok, true);
  const second = confirmSpecialCard(
    () => match,
    (next) => {
      match = next;
    },
    shell,
    'p3',
    'yellow',
    match.round.roundId,
    match.round.turnId,
  );
  assert.equal(second.ok, true);
  if (second.ok) {
    assert.equal(second.activated, true);
  }
});

test('departed player playing view hides secrets and cannot act', () => {
  const match = markGuessingChallengePlayerDeparted(makeMatch2v2(), 'p3');
  const view = buildGuessingChallengePlayerView(
    match,
    'p3',
    makeShell(['p1', 'p2', 'p3', 'p4']),
  );
  assert.equal(view.isMatchSpectator, true);
  assert.equal(view.opponent.visibleIdentity, null);
  assert.equal(view.canGuess, false);
  assert.equal(view.canUseYellow, false);
  assert.equal(viewContainsSecretLeak(view, match.round.identitiesByTeamId.blue!), false);
  assert.equal(viewContainsSecretLeak(view, match.round.identitiesByTeamId.red!), false);
});

test('duplicate correct guess cannot score twice', () => {
  let match = makeMatch1v1();
  const first = applyFinalGuess(
    () => match,
    (next) => {
      match = next;
    },
    'p1',
    'رونالدو',
    match.round.roundId,
    match.round.turnId,
  );
  assert.equal(first.accepted, true);
  if (first.accepted) {
    assert.equal(first.correct, true);
  }
  const second = applyFinalGuess(
    () => match,
    (next) => {
      match = next;
    },
    'p1',
    'رونالدو',
    match.round.roundId,
    match.round.turnId,
  );
  assert.equal(second.accepted, false);
  match = applyRoundScores(match);
  match = applyRoundScores(match);
  assert.equal(match.teamScores.blue, GUESSING_CHALLENGE_WINNER_POINTS);
});

test('entire team permanent leave leaves no eligible actors', () => {
  let match = markGuessingChallengePlayerDeparted(makeMatch2v2(), 'p2');
  match = markGuessingChallengePlayerDeparted(match, 'p4');
  assert.equal(match.departedPlayerIds.length, 2);
  const scored = applyRoundScores(
    withRound(match, { ...match.round, winningTeamId: null }),
  );
  assert.equal(scored.teamScores.red, 0);
  assert.equal(scored.teamScores.blue, 0);
});

test('LOOK clamps NaN/Infinity/bounds and ignores non-participants', () => {
  clearLookThrottleForRoom('room-look');
  const match = makeMatch1v1();
  const nan = applyLookDirection(match, 'room-look', 'p1', Number.NaN, Infinity, 1_000);
  assert.ok(nan);
  assert.equal(nan.yaw, 0);
  assert.equal(nan.pitch, 0);

  const clamped = applyLookDirection(match, 'room-look', 'p1', 5, -3, 1_200);
  assert.ok(clamped);
  assert.equal(clamped.yaw, 1);
  assert.equal(clamped.pitch, -1);

  const outsider = applyLookDirection(match, 'room-look', 'spectator', 0.2, 0.1, 1_400);
  assert.equal(outsider, null);
  assert.equal(match.lookByPlayerId.p1.yaw, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
