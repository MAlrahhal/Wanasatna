/**
 * Unit tests for Who Wrote It (من كتبها؟).
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
  shuffleIds,
  validateSubmittedAnswer,
} from '../src/modules/game/plugins/who-wrote-it/answers.js';
import {
  applyRoundScores,
  buildRoundResultEntries,
  computePlayerRoundPoints,
  countCorrectGuesses,
} from '../src/modules/game/plugins/who-wrote-it/scoring.js';
import {
  applyOwnerGuess,
  beginGuessingPhase,
  buildWhoWroteItPlayerView,
  getEligibleOwnerOptions,
  getGuessableAnswerIds,
  hasCompletedGuessing,
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

test('opaque answer ids do not encode player ids', () => {
  const id = createOpaqueAnswerId();
  assert.match(id, /^ans_[a-f0-9]{16}$/);
  assert.equal(id.includes('p1'), false);
});

test('empty answer rejected', () => {
  assert.equal(validateSubmittedAnswer('   ').ok, false);
  assert.equal(validateSubmittedAnswer('').ok, false);
});

test('over-length answer rejected', () => {
  const long = 'ا'.repeat(WHO_WROTE_IT_MAX_ANSWER_LENGTH + 1);
  assert.equal(validateSubmittedAnswer(long).ok, false);
});

test('valid answer accepted and trimmed', () => {
  const result = validateSubmittedAnswer('  مرحبا   بالعالم  ');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.text, 'مرحبا بالعالم');
  }
});

test('duplicate answer submission ignored', () => {
  let match = makeMatch();
  match = submitAnswerToMatch(match, 'p1', 'أول إجابة');
  match = submitAnswerToMatch(match, 'p1', 'ثاني إجابة');
  assert.equal(match.round.answers.length, 1);
  assert.equal(match.round.answers[0]?.text, 'أول إجابة');
});

test('answers private before guessing — no owners in player view', () => {
  let match = seedAnswers(makeMatch());
  const view = buildWhoWroteItPlayerView(match, 'p2', makeShell());
  assert.equal(view.gamePhase, 'answering');
  assert.equal(view.revealEntries.length, 0);
  assert.equal(view.currentAnonymousAnswer, null);
  const serialized = JSON.stringify(view);
  assert.equal(serialized.includes('ownerPlayerId'), false);
  assert.equal(serialized.includes('أنام إذا طفشت'), false);
});

test('begin guessing creates one authoritative shuffled order', () => {
  let match = seedAnswers(makeMatch());
  match = beginGuessingPhase(match);
  assert.equal(match.round.gamePhase, 'guessing');
  assert.equal(match.round.shuffledAnswerIds.length, 4);
  assert.deepEqual(
    [...match.round.shuffledAnswerIds].sort(),
    match.round.answers.map((answer) => answer.answerId).sort(),
  );
});

test('own answer excluded from guessing sequence', () => {
  let match = seedAnswers(makeMatch());
  match = beginGuessingPhase(match);
  const guessable = getGuessableAnswerIds(match, 'p1');
  assert.equal(guessable.length, 3);
  for (const answerId of guessable) {
    const answer = match.round.answers.find((entry) => entry.answerId === answerId);
    assert.ok(answer);
    assert.notEqual(answer.ownerPlayerId, 'p1');
  }
});

test('anonymous player view exposes only answerId + text', () => {
  let match = seedAnswers(makeMatch());
  match = beginGuessingPhase(match);
  const view = buildWhoWroteItPlayerView(match, 'p1', makeShell());
  assert.ok(view.currentAnonymousAnswer);
  assert.equal(typeof view.currentAnonymousAnswer.answerId, 'string');
  assert.equal(typeof view.currentAnonymousAnswer.text, 'string');
  const serialized = JSON.stringify(view.currentAnonymousAnswer);
  assert.equal(serialized.includes('ownerPlayerId'), false);
  assert.equal(serialized.includes('ownerName'), false);
});

test('selecting self rejected via eligible options', () => {
  let match = seedAnswers(makeMatch());
  match = beginGuessingPhase(match);
  const options = getEligibleOwnerOptions(match, 'p1');
  assert.equal(options.some((option) => option.playerId === 'p1'), false);
});

test('reusing same owner for two answers rejected by used set', () => {
  let match = seedAnswers(makeMatch());
  match = beginGuessingPhase(match);
  const guessable = getGuessableAnswerIds(match, 'p1');
  const firstAnswerId = guessable[0]!;
  const firstOwner = getEligibleOwnerOptions(match, 'p1')[0]!.playerId;
  match = applyOwnerGuess(match, 'p1', firstAnswerId, firstOwner);
  const remainingOptions = getEligibleOwnerOptions(match, 'p1');
  assert.equal(remainingOptions.some((option) => option.playerId === firstOwner), false);
});

test('final remaining owner auto-assigned', () => {
  let match = seedAnswers(makeMatch());
  match = beginGuessingPhase(match);
  const guessable = getGuessableAnswerIds(match, 'p1');
  assert.equal(guessable.length, 3);

  // Assign first two owners (third auto-assigns)
  const ownersPool = ['p2', 'p3', 'p4'];
  match = applyOwnerGuess(match, 'p1', guessable[0]!, ownersPool[0]!);
  match = applyOwnerGuess(match, 'p1', guessable[1]!, ownersPool[1]!);

  assert.equal(hasCompletedGuessing(match, 'p1'), true);
  assert.ok(match.round.guessesByPlayerId.p1?.[guessable[2]!]);
});

test('correct guess awards +100; incorrect 0; accumulate', () => {
  let match = seedAnswers(makeMatch());
  match = beginGuessingPhase(match);
  const guessable = getGuessableAnswerIds(match, 'p1');

  const byOwner = Object.fromEntries(
    match.round.answers.map((answer) => [answer.ownerPlayerId, answer.answerId]),
  );

  // Correct for p2, wrong for p3, correct for p4 via remaining auto if needed
  match = applyOwnerGuess(match, 'p1', byOwner.p2!, 'p2');
  match = applyOwnerGuess(match, 'p1', byOwner.p3!, 'p4');
  // auto-assigns remaining p3 answer → wrong if guessed as leftover

  const correct = countCorrectGuesses(match, 'p1');
  assert.ok(correct >= 1);
  assert.equal(computePlayerRoundPoints(2), 2 * WHO_WROTE_IT_POINTS_PER_CORRECT);
  assert.equal(computePlayerRoundPoints(0), 0);

  match = applyRoundScores(match);
  const results = buildRoundResultEntries(match);
  const p1 = results.find((entry) => entry.playerId === 'p1');
  assert.ok(p1);
  assert.equal(p1.roundPoints, correct * WHO_WROTE_IT_POINTS_PER_CORRECT);
  assert.equal(p1.totalPoints, p1.roundPoints);
});

test('equal correct count gives equal round score', () => {
  assert.equal(computePlayerRoundPoints(2), computePlayerRoundPoints(2));
});

test('shuffleIds permutes without losing items', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const shuffled = shuffleIds(ids);
  assert.deepEqual([...shuffled].sort(), [...ids].sort());
});

test('reveal entries appear only after round-results', () => {
  let match = seedAnswers(makeMatch());
  match = beginGuessingPhase(match);
  const guessable = getGuessableAnswerIds(match, 'p1');
  for (const answerId of guessable) {
    const options = getEligibleOwnerOptions(match, 'p1');
    if (options[0]) {
      match = applyOwnerGuess(match, 'p1', answerId, options[0].playerId);
    }
  }

  match = withRound(match, { ...match.round, gamePhase: 'round-results' });
  match = applyRoundScores(match);
  const view = buildWhoWroteItPlayerView(match, 'p1', makeShell());
  assert.ok(view.revealEntries.length >= 3);
  assert.ok(view.revealEntries.every((entry) => typeof entry.ownerName === 'string'));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
