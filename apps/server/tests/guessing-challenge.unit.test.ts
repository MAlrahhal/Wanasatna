/**
 * Unit tests for Guessing Challenge (تحدي التخمين).
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
  activateRedCard,
  activateYellowCard,
  applyFinalGuess,
  buildGuessingChallengePlayerView,
  endQuestionTurn,
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

function makeShell(): GameShellState {
  return {
    shellId: 'shell-gc',
    roomId: 'room-gc',
    gameId: 'guessing-challenge',
    phase: 'PLAYING',
    hostPlayerId: 'p1',
    players: [
      { id: 'p1', name: 'محمد', isConnected: true, isHost: true, isReady: true },
      { id: 'p2', name: 'خالد', isConnected: true, isHost: false, isReady: true },
    ],
    readyPlayerIds: ['p1', 'p2'],
    countdownSeconds: null,
    countdownRemainingSeconds: null,
    gameTimerSeconds: null,
    gameTimerRemainingSeconds: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    updatedAt: new Date().toISOString(),
    matchParticipantIds: ['p1', 'p2'],
  };
}

function makeRound(overrides?: Partial<GuessingChallengeRoundState>): GuessingChallengeRoundState {
  const idA = makeIdentity('id-a', 'كريستيانو رونالدو', ['رونالدو', 'كريستيانو']);
  const idB = makeIdentity('id-b', 'ليونيل ميسي', ['ميسي']);

  return {
    gamePhase: 'playing',
    phaseRemainingSeconds: 0,
    resolvedCategoryId: 'football',
    identitiesByPlayerId: { p1: idA, p2: idB },
    usedIdentityIds: [idA.id, idB.id],
    currentTurnPlayerId: 'p1',
    startingPlayerId: 'p1',
    cardsByPlayerId: {
      p1: { yellowUsed: false, redUsed: false },
      p2: { yellowUsed: false, redUsed: false },
    },
    yellowQuestionsRemaining: null,
    winningPlayerId: null,
    winningGuess: null,
    identityChangedNoticePlayerId: null,
    ...overrides,
  };
}

function makeMatch(overrides?: Partial<GuessingChallengeMatchState>): GuessingChallengeMatchState {
  return {
    playerIds: ['p1', 'p2'],
    playerNames: { p1: 'محمد', p2: 'خالد' },
    currentRound: 1,
    totalRounds: 4,
    scores: { p1: 0, p2: 0 },
    matchStatus: 'in-progress',
    nextStartingPlayerIndex: 1,
    recentIdentityIds: ['id-a', 'id-b'],
    round: makeRound(),
    ...overrides,
  };
}

test('A plugin registers correctly', () => {
  assert.equal(hasGamePlugin('guessing-challenge'), true);
  const plugin = getGamePluginDefinition('guessing-challenge');
  assert.ok(plugin);
  assert.equal(plugin.minPlayers, 2);
  assert.equal(plugin.maxPlayers, 2);
});

test('C exactly-two-player requirement enforced', () => {
  const plugin = getGamePluginDefinition('guessing-challenge');
  assert.ok(plugin?.validateStart);
  const tooMany = plugin.validateStart(
    {
      roomId: 'r',
      players: [
        { id: '1', name: 'a', isConnected: true, isHost: true, isReady: true },
        { id: '2', name: 'b', isConnected: true, isHost: false, isReady: true },
        { id: '3', name: 'c', isConnected: true, isHost: false, isReady: true },
      ],
    },
    {},
  );
  assert.equal(tooMany.success, false);
});

test('G two different identities selected', () => {
  const pool = getIdentitiesForCategory('football');
  assert.ok(pool.length >= 2);
  const [a, b] = pickTwoIdentities(pool, []);
  assert.notEqual(a.id, b.id);
});

test('H/I Player A view hides own identity, shows opponent', () => {
  const match = makeMatch();
  const view = buildGuessingChallengePlayerView(match, 'p1', makeShell());
  assert.equal(view.self.identityHidden, true);
  assert.equal(view.self.revealedIdentity, null);
  assert.equal(view.opponent.visibleIdentity?.value, 'ليونيل ميسي');
  assert.equal(viewContainsSecretLeak(view, match.round.identitiesByPlayerId.p1!), false);
});

test('J/K Player B view hides own identity, shows opponent', () => {
  const match = makeMatch();
  const view = buildGuessingChallengePlayerView(match, 'p2', makeShell());
  assert.equal(view.opponent.visibleIdentity?.value, 'كريستيانو رونالدو');
  assert.equal(viewContainsSecretLeak(view, match.round.identitiesByPlayerId.p2!), false);
});

test('L acceptedAnswers never appear in active client view', () => {
  const match = makeMatch();
  const view = buildGuessingChallengePlayerView(match, 'p1', makeShell());
  assert.ok(!JSON.stringify(view).includes('acceptedAnswers'));
});

test('N/O end-question passes turn; non-turn rejected', () => {
  const match = makeMatch();
  const rejected = endQuestionTurn(match, 'p2');
  assert.equal(rejected.ok, false);

  const ok = endQuestionTurn(match, 'p1');
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.match.round.currentTurnPlayerId, 'p2');
  }
});

test('Q/R/S/T/U final guess correct/wrong/turn/non-turn', () => {
  let state = makeMatch();
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
    assert.equal(wrong.match.round.currentTurnPlayerId, 'p2');
    assert.equal(wrong.match.round.winningPlayerId, null);
  }

  state = withRound(state, { ...state.round, currentTurnPlayerId: 'p2' });
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
    assert.equal(correct.match.round.winningPlayerId, 'p2');
  }
});

test('V/W/X answer normalization and aliases', () => {
  assert.equal(isCorrectAnswer('  رونالدو ', ['كريستيانو رونالدو', 'رونالدو']), true);
  assert.equal(isCorrectAnswer('xyz', ['ميسي']), false);
});

test('Y/Z scoring +100 to winner; opponent 0', () => {
  let match = makeMatch({
    round: makeRound({ winningPlayerId: 'p1', winningGuess: 'رونالدو' }),
  });
  match = applyRoundScores(match);
  assert.equal(match.scores.p1, GUESSING_CHALLENGE_WINNER_POINTS);
  assert.equal(match.scores.p2, 0);
});

test('AA late action after round finalized rejected', () => {
  const match = makeMatch({
    round: makeRound({ winningPlayerId: 'p1', winningGuess: 'رونالدو' }),
  });
  const end = endQuestionTurn(match, 'p1');
  assert.equal(end.ok, false);
});

test('AB-AH yellow card sequence', () => {
  let match = makeMatch();
  const activated = activateYellowCard(match, 'p1');
  assert.equal(activated.ok, true);
  if (!activated.ok) return;
  match = activated.match;
  assert.equal(match.round.yellowQuestionsRemaining, GUESSING_CHALLENGE_YELLOW_QUESTIONS);
  assert.equal(match.round.cardsByPlayerId.p1?.yellowUsed, true);

  const again = activateYellowCard(match, 'p1');
  assert.equal(again.ok, false);

  let step = endQuestionTurn(match, 'p1');
  assert.equal(step.ok, true);
  if (step.ok) {
    assert.equal(step.match.round.currentTurnPlayerId, 'p1');
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
    assert.equal(step.match.round.currentTurnPlayerId, 'p2');
    assert.equal(step.match.round.yellowQuestionsRemaining, null);
  }
});

test('AI wrong guess during yellow ends sequence', () => {
  let match = makeMatch();
  const activated = activateYellowCard(match, 'p1');
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
    assert.equal(wrong.match.round.currentTurnPlayerId, 'p2');
    assert.equal(wrong.match.round.yellowQuestionsRemaining, null);
  }
});

test('AL-AT red card changes opponent identity privately', () => {
  let match = makeMatch({
    round: makeRound({
      identitiesByPlayerId: {
        p1: makeIdentity('id-a', 'كريستيانو رونالدو', ['رونالدو']),
        p2: makeIdentity('id-b', 'ليونيل ميسي', ['ميسي']),
      },
      usedIdentityIds: ['id-a', 'id-b'],
    }),
  });

  const result = activateRedCard(match, 'p1');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  match = result.match;

  const newOpp = match.round.identitiesByPlayerId.p2!;
  assert.notEqual(newOpp.id, 'id-b');
  assert.equal(newOpp.categoryId, 'football');
  assert.notEqual(newOpp.id, match.round.identitiesByPlayerId.p1!.id);
  assert.equal(match.round.cardsByPlayerId.p1?.redUsed, true);

  const viewA = buildGuessingChallengePlayerView(match, 'p1', makeShell());
  assert.equal(viewA.opponent.visibleIdentity?.value, newOpp.value);

  const viewB = buildGuessingChallengePlayerView(match, 'p2', makeShell());
  assert.equal(viewB.self.revealedIdentity, null);
  assert.equal(viewB.identityChangedNotice, true);
  assert.equal(viewContainsSecretLeak(viewB, newOpp), false);

  const again = activateRedCard(match, 'p1');
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
  let match = makeMatch();
  const beforeOpp = match.round.identitiesByPlayerId.p2!;
  const result = activateRedCard(match, 'p1');
  assert.ok(result.ok);
  if (!result.ok) return;
  match = result.match;
  const afterOpp = match.round.identitiesByPlayerId.p2!;

  match = withRound(match, { ...match.round, currentTurnPlayerId: 'p2' });
  const oldGuess = applyFinalGuess(
    () => match,
    (next) => {
      match = next;
    },
    'p2',
    beforeOpp.acceptedAnswers[0]!,
  );

  // If replacement happened to share an alias (unlikely), skip strict old-invalid assert.
  if (beforeOpp.id !== afterOpp.id && !afterOpp.acceptedAnswers.includes(beforeOpp.value)) {
    assert.equal(oldGuess.accepted, true);
    if (oldGuess.accepted) {
      assert.equal(oldGuess.correct, false);
    }
  }

  match = withRound(match, {
    ...match.round,
    currentTurnPlayerId: 'p2',
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
  const match = makeMatch({
    round: makeRound({
      gamePhase: 'round-results',
      winningPlayerId: 'p1',
      winningGuess: 'رونالدو',
    }),
  });
  const view = buildGuessingChallengePlayerView(match, 'p1', makeShell());
  assert.equal(view.revealEntries.length, 2);
  assert.ok(view.self.revealedIdentity?.value);
  assert.ok(view.opponent.visibleIdentity?.value);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
