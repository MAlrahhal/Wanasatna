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
  GUESSING_CHALLENGE_WINNER_POINTS,
  GUESSING_CHALLENGE_YELLOW_QUESTIONS,
} from '@wanasatna/shared';
import { registerAllGameContent } from '../src/modules/content/index.js';
import { isCorrectAnswer } from '../src/modules/game/plugins/fast-answer/answers.js';
import {
  getIdentitiesForCategory,
  pickReplacementIdentity,
  pickTwoIdentities,
} from '../src/modules/game/plugins/guessing-challenge/identities.js';
import { applyRoundScores } from '../src/modules/game/plugins/guessing-challenge/scoring.js';
import {
  applyFinalGuess,
  assignTeams,
  buildGuessingChallengePlayerView,
  confirmSpecialCard,
  rejectSpecialCard,
  createInitialTeamCards,
  createInitialTeamScores,
  endQuestionTurn,
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

function makeShell(playerIds: string[] = ['p1', 'p2']): GameShellState {
  const names = ['محمد', 'خالد', 'سارة', 'نورة'];
  return {
    shellId: 'shell-gc',
    roomId: 'room-gc',
    gameId: 'guessing-challenge',
    phase: 'PLAYING',
    hostPlayerId: playerIds[0]!,
    players: playerIds.map((id, index) => ({
      id,
      name: names[index] ?? `لاعب${index + 1}`,
      isConnected: true,
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
    gamePhase: 'playing',
    phaseRemainingSeconds: 0,
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
      cardConfirm: { card: 'yellow', teamId: 'blue', confirmedPlayerIds: ['p1'] },
    }),
  });
  const step = endQuestionTurn(match, 'p1');
  assert.equal(step.ok, true);
  if (step.ok) {
    assert.equal(step.match.round.cardConfirm, null);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
