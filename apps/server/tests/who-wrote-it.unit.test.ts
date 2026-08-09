/**
 * Unit tests for Who Wrote It (من كتبها؟) — global guessing flow.
 * Run: pnpm --filter @wanasatna/server test:who-wrote-it
 */
import assert from 'node:assert/strict';
import type {
  GameShellState,
  WhoWroteItMatchState,
  WhoWroteItRoundState,
} from '@wanasatna/shared';
import {
  WHO_WROTE_IT_MAX_ANSWER_LENGTH,
  WHO_WROTE_IT_POINTS_PER_CORRECT,
} from '@wanasatna/shared';
import {
  createOpaqueAnswerId,
  validateSubmittedAnswer,
} from '../src/modules/game/plugins/who-wrote-it/answers.js';
import {
  applyRoundScores,
  buildRoundResultEntries,
  computePlayerRoundPoints,
  countCorrectGuesses,
} from '../src/modules/game/plugins/who-wrote-it/scoring.js';
import {
  advanceGlobalAnswerOrComplete,
  allRequiredHaveGuessedCurrent,
  applyOwnerGuess,
  beginGuessingPhase,
  buildWhoWroteItPlayerView,
  getCurrentAnswerId,
  getEligibleOwnerOptions,
  submitAnswerToMatch,
  withRound,
} from '../src/modules/game/plugins/who-wrote-it/state.js';

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

function makeShell(playerIds: string[] = ['p1', 'p2', 'p3', 'p4']): GameShellState {
  return {
    shellId: 'shell-wwi',
    roomId: 'room-wwi',
    gameId: 'who-wrote-it',
    phase: 'PLAYING',
    hostPlayerId: 'p1',
    players: playerIds.map((id, index) => ({
      id,
      name: ['محمد', 'خالد', 'سارة', 'عبدالله'][index] ?? `لاعب${index}`,
      isConnected: true,
      isHost: id === 'p1',
      isReady: true,
    })),
    readyPlayerIds: playerIds,
    countdownSeconds: null,
    countdownRemainingSeconds: null,
    gameTimerSeconds: null,
    gameTimerRemainingSeconds: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    updatedAt: new Date().toISOString(),
    matchParticipantIds: playerIds,
  };
}

function makeRound(overrides?: Partial<WhoWroteItRoundState>): WhoWroteItRoundState {
  return {
    gamePhase: 'answering',
    phaseRemainingSeconds: 0,
    questionId: 'funny-1',
    question: 'وش أغرب عذر ممكن تستخدمه؟',
    categoryId: 'funny',
    answers: [],
    shuffledAnswerIds: [],
    currentAnswerIndex: 0,
    guessesByPlayerId: {},
    ...overrides,
  };
}

function makeMatch(overrides?: Partial<WhoWroteItMatchState>): WhoWroteItMatchState {
  const playerIds = ['p1', 'p2', 'p3', 'p4'];

  return {
    playerIds,
    playerNames: { p1: 'محمد', p2: 'خالد', p3: 'سارة', p4: 'عبدالله' },
    currentRound: 1,
    totalRounds: 4,
    scores: { p1: 0, p2: 0, p3: 0, p4: 0 },
    matchStatus: 'in-progress',
    recentQuestionIds: ['funny-1'],
    round: makeRound(),
    ...overrides,
    round: {
      ...makeRound(),
      ...(overrides?.round ?? {}),
    },
  };
}

function seedAnswers(match: WhoWroteItMatchState): WhoWroteItMatchState {
  let next = match;
  for (const [playerId, text] of [
    ['p1', 'أنام إذا طفشت'],
    ['p2', 'أطلب بيتزا'],
    ['p3', 'أسافر فوراً'],
    ['p4', 'أتصل بأمي'],
  ] as const) {
    next = submitAnswerToMatch(next, playerId, text);
  }
  return next;
}

function startGuessingWithOrder(
  match: WhoWroteItMatchState,
  ownerOrder: string[],
): WhoWroteItMatchState {
  let next = seedAnswers(match);
  next = beginGuessingPhase(next);
  const byOwner = Object.fromEntries(
    next.round.answers.map((answer) => [answer.ownerPlayerId, answer.answerId]),
  );
  const shuffledAnswerIds = ownerOrder.map((ownerId) => byOwner[ownerId]!);
  return withRound(next, {
    ...next.round,
    shuffledAnswerIds,
    currentAnswerIndex: 0,
  });
}

test('opaque answer ids do not encode player ids', () => {
  const id = createOpaqueAnswerId();
  assert.match(id, /^ans_[a-f0-9]{16}$/);
});

test('empty / over-length answers rejected', () => {
  assert.equal(validateSubmittedAnswer('   ').ok, false);
  assert.equal(
    validateSubmittedAnswer('ا'.repeat(WHO_WROTE_IT_MAX_ANSWER_LENGTH + 1)).ok,
    false,
  );
});

test('A: all clients receive same current anonymous answer', () => {
  const match = startGuessingWithOrder(makeMatch(), ['p2', 'p1', 'p3', 'p4']);
  const shell = makeShell();
  const views = ['p1', 'p2', 'p3', 'p4'].map((id) =>
    buildWhoWroteItPlayerView(match, id, shell),
  );
  const answerIds = views.map((view) => view.currentAnonymousAnswer?.answerId);
  assert.ok(answerIds[0]);
  assert.ok(answerIds.every((id) => id === answerIds[0]));
});

test('B: current answer owner receives isOwnAnswer true', () => {
  const match = startGuessingWithOrder(makeMatch(), ['p2', 'p1', 'p3', 'p4']);
  const shell = makeShell();
  assert.equal(buildWhoWroteItPlayerView(match, 'p2', shell).isOwnAnswer, true);
  assert.equal(buildWhoWroteItPlayerView(match, 'p1', shell).isOwnAnswer, false);
});

test('C: owner cannot submit — canSubmitGuess false', () => {
  const match = startGuessingWithOrder(makeMatch(), ['p2', 'p1', 'p3', 'p4']);
  const shell = makeShell();
  assert.equal(buildWhoWroteItPlayerView(match, 'p2', shell).canSubmitGuess, false);
  assert.equal(buildWhoWroteItPlayerView(match, 'p1', shell).canSubmitGuess, true);
});

test('E: guesser cannot select themselves', () => {
  const match = startGuessingWithOrder(makeMatch(), ['p2', 'p1', 'p3', 'p4']);
  const options = getEligibleOwnerOptions(match, 'p1');
  assert.equal(options.some((option) => option.playerId === 'p1'), false);
  assert.ok(options.some((option) => option.playerId === 'p2'));
});

test('F: same owner may be selected again on a different answer', () => {
  let match = startGuessingWithOrder(makeMatch(), ['p2', 'p3', 'p4', 'p1']);
  const firstId = getCurrentAnswerId(match)!;
  match = applyOwnerGuess(match, 'p1', firstId, 'p2');
  const advanced = advanceGlobalAnswerOrComplete(match);
  match = advanced.match;
  const secondId = getCurrentAnswerId(match)!;
  // Selecting p2 again on a different answer is allowed
  match = applyOwnerGuess(match, 'p1', secondId, 'p2');
  assert.equal(match.round.guessesByPlayerId.p1?.[firstId], 'p2');
  assert.equal(match.round.guessesByPlayerId.p1?.[secondId], 'p2');
});

test('G/H: answer advances only after all required non-owners submit', () => {
  let match = startGuessingWithOrder(makeMatch(), ['p2', 'p1', 'p3', 'p4']);
  const shell = makeShell();
  const answerId = getCurrentAnswerId(match)!;
  const indexBefore = match.round.currentAnswerIndex;

  match = applyOwnerGuess(match, 'p1', answerId, 'p2');
  assert.equal(allRequiredHaveGuessedCurrent(match, shell), false);
  assert.equal(match.round.currentAnswerIndex, indexBefore);

  match = applyOwnerGuess(match, 'p3', answerId, 'p2');
  assert.equal(allRequiredHaveGuessedCurrent(match, shell), false);

  match = applyOwnerGuess(match, 'p4', answerId, 'p3');
  assert.equal(allRequiredHaveGuessedCurrent(match, shell), true);

  const advanced = advanceGlobalAnswerOrComplete(match);
  assert.equal(advanced.completed, false);
  assert.equal(advanced.match.round.currentAnswerIndex, indexBefore + 1);
});

test('I: everyone advances to same next answer', () => {
  let match = startGuessingWithOrder(makeMatch(), ['p2', 'p3', 'p4', 'p1']);
  const shell = makeShell();
  const firstId = getCurrentAnswerId(match)!;
  for (const guesser of ['p1', 'p3', 'p4']) {
    match = applyOwnerGuess(match, guesser, firstId, 'p2');
  }
  match = advanceGlobalAnswerOrComplete(match).match;
  const views = ['p1', 'p2', 'p3', 'p4'].map((id) =>
    buildWhoWroteItPlayerView(match, id, shell),
  );
  const nextIds = views.map((view) => view.currentAnonymousAnswer?.answerId);
  assert.ok(nextIds[0]);
  assert.notEqual(nextIds[0], firstId);
  assert.ok(nextIds.every((id) => id === nextIds[0]));
});

test('J: every submitted answer appears exactly once', () => {
  const match = startGuessingWithOrder(makeMatch(), ['p4', 'p1', 'p2', 'p3']);
  assert.equal(match.round.shuffledAnswerIds.length, 4);
  assert.equal(new Set(match.round.shuffledAnswerIds).size, 4);
});

test('K: final answer completion signals done', () => {
  let match = startGuessingWithOrder(makeMatch(), ['p1', 'p2', 'p3', 'p4']);
  match = withRound(match, { ...match.round, currentAnswerIndex: 3 });
  const advanced = advanceGlobalAnswerOrComplete(match);
  assert.equal(advanced.completed, true);
});

test('L/M/N: scoring +100; own answer not scored; max 300 for 4 players', () => {
  let match = startGuessingWithOrder(makeMatch(), ['p2', 'p3', 'p4', 'p1']);
  const byOwner = Object.fromEntries(
    match.round.answers.map((answer) => [answer.ownerPlayerId, answer.answerId]),
  );

  // p1 guesses all three others correctly
  match = applyOwnerGuess(match, 'p1', byOwner.p2!, 'p2');
  match = applyOwnerGuess(match, 'p1', byOwner.p3!, 'p3');
  match = applyOwnerGuess(match, 'p1', byOwner.p4!, 'p4');

  assert.equal(countCorrectGuesses(match, 'p1'), 3);
  assert.equal(computePlayerRoundPoints(3), 300);
  match = applyRoundScores(match);
  const results = buildRoundResultEntries(match);
  const p1 = results.find((entry) => entry.playerId === 'p1');
  assert.ok(p1);
  assert.equal(p1.guessTotal, 3);
  assert.equal(p1.roundPoints, 300);
});

test('O: reconnect restores same global currentAnswerIndex via view', () => {
  let match = startGuessingWithOrder(makeMatch(), ['p2', 'p3', 'p4', 'p1']);
  match = withRound(match, { ...match.round, currentAnswerIndex: 2 });
  const shell = makeShell();
  const view = buildWhoWroteItPlayerView(match, 'p1', shell);
  assert.equal(view.guessingProgressIndex, 3);
  assert.equal(view.currentAnonymousAnswer?.answerId, match.round.shuffledAnswerIds[2]);
});

test('P: reconnect after guessing restores waiting state', () => {
  let match = startGuessingWithOrder(makeMatch(), ['p2', 'p3', 'p4', 'p1']);
  const answerId = getCurrentAnswerId(match)!;
  match = applyOwnerGuess(match, 'p1', answerId, 'p2');
  const view = buildWhoWroteItPlayerView(match, 'p1', makeShell());
  assert.equal(view.hasGuessedCurrentAnswer, true);
  assert.equal(view.canSubmitGuess, false);
  assert.equal(view.isOwnAnswer, false);
});

test('Q: reconnect on own answer restores owner waiting', () => {
  const match = startGuessingWithOrder(makeMatch(), ['p2', 'p3', 'p4', 'p1']);
  const view = buildWhoWroteItPlayerView(match, 'p2', makeShell());
  assert.equal(view.isOwnAnswer, true);
  assert.equal(view.canSubmitGuess, false);
  assert.ok(view.currentAnonymousAnswer);
});

test('privacy: anonymous payload has no owner fields', () => {
  const match = startGuessingWithOrder(makeMatch(), ['p2', 'p1', 'p3', 'p4']);
  const view = buildWhoWroteItPlayerView(match, 'p1', makeShell());
  const serialized = JSON.stringify(view.currentAnonymousAnswer);
  assert.equal(serialized.includes('ownerPlayerId'), false);
  assert.equal(view.isOwnAnswer, false);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
