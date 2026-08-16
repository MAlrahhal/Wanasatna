/**
 * Unit tests for Fast Answer (أسرع إجابة).
 * Run: pnpm --filter @wanasatna/server test:fast-answer
 */
import assert from 'node:assert/strict';
import type {
  FastAnswerMatchState,
  FastAnswerRoundState,
  GameShellState,
} from '@wanasatna/shared';
import {
  FAST_ANSWER_DEFAULT_ROUNDS,
  FAST_ANSWER_QUESTION_SECONDS,
  FAST_ANSWER_ROUND_RESULTS_SECONDS,
  FAST_ANSWER_WINNER_POINTS,
} from '@wanasatna/shared';
import {
  isCorrectAnswer,
  normalizeAnswerText,
  revealPrimaryAnswer,
} from '../src/modules/game/plugins/fast-answer/answers.js';
import {
  chooseRoundCategoryId,
  FAST_ANSWER_RANDOM_CATEGORY_ID,
  FAST_ANSWER_RANDOM_CATEGORY_LABEL,
} from '../src/modules/game/plugins/fast-answer/questions.js';
import {
  applyRoundScores,
  buildRoundResultEntries,
  computePlayerRoundPoints,
} from '../src/modules/game/plugins/fast-answer/scoring.js';
import {
  buildFastAnswerPlayerView,
  resolveTotalRounds,
  tryAcceptCorrectAnswer,
  withRound,
} from '../src/modules/game/plugins/fast-answer/state.js';

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

function makeShell(playerIds: string[] = ['p1', 'p2', 'p3']): GameShellState {
  return {
    shellId: 'shell-fa',
    roomId: 'room-fa',
    gameId: 'fast-answer',
    phase: 'PLAYING',
    hostPlayerId: 'p1',
    players: playerIds.map((id, index) => ({
      id,
      name: id === 'p1' ? 'محمد' : id === 'p2' ? 'خالد' : id === 'p3' ? 'سامي' : `لاعب${index}`,
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

function makeRound(overrides?: Partial<FastAnswerRoundState>): FastAnswerRoundState {
  return {
    roundId: 'round-1',
    gamePhase: 'question',
    phaseRemainingSeconds: 15,
    questionId: 'q1',
    question: 'ما عاصمة مصر؟',
    categoryId: 'countries',
    acceptedAnswers: ['القاهرة', 'قاهره'],
    deadlineAtMs: Date.now() + 15_000,
    winnerPlayerId: null,
    timedOut: false,
    ...overrides,
  };
}

function makeMatch(overrides?: Partial<FastAnswerMatchState>): FastAnswerMatchState {
  const playerIds = ['p1', 'p2', 'p3'];
  return {
    playerIds,
    playerNames: { p1: 'محمد', p2: 'خالد', p3: 'سامي' },
    currentRound: 1,
    totalRounds: FAST_ANSWER_DEFAULT_ROUNDS,
    scores: { p1: 0, p2: 0, p3: 0 },
    matchStatus: 'in-progress',
    lockedCategoryId: 'countries',
    lockedCategoryLabel: 'بلدان',
    usedRoundCategoryIds: ['countries'],
    roundTimeSeconds: FAST_ANSWER_QUESTION_SECONDS,
    recentQuestionIds: ['q1'],
    round: makeRound(),
    ...overrides,
  };
}

test('production constants: 5 rounds, 15s question, 10s results', () => {
  assert.equal(FAST_ANSWER_DEFAULT_ROUNDS, 5);
  assert.equal(FAST_ANSWER_QUESTION_SECONDS, 15);
  assert.equal(FAST_ANSWER_ROUND_RESULTS_SECONDS, 10);
  assert.equal(resolveTotalRounds(), 5);
});

test('normalize: trim + lower + collapse spaces', () => {
  assert.equal(normalizeAnswerText('  Hello   World  '), 'hello world');
});

test('normalize: remove tatweel', () => {
  assert.equal(normalizeAnswerText('قـاهـرة'), 'قاهرة');
});

test('normalize: أإآ → ا', () => {
  assert.equal(normalizeAnswerText('أحمد'), 'احمد');
  assert.equal(normalizeAnswerText('إبراهيم'), 'ابراهيم');
  assert.equal(normalizeAnswerText('آلة'), 'الة');
});

test('normalize: ى → ي', () => {
  assert.equal(normalizeAnswerText('مستشفى'), 'مستشفي');
});

test('normalize: does NOT map ة → ه', () => {
  assert.equal(normalizeAnswerText('مدرسة'), 'مدرسة');
  assert.equal(normalizeAnswerText('مدرسه'), 'مدرسه');
  assert.notEqual(normalizeAnswerText('مدرسة'), normalizeAnswerText('مدرسه'));
});

test('normalize: hyphen/dash becomes space separator', () => {
  assert.equal(normalizeAnswerText('كأس-العالم'), normalizeAnswerText('كأس العالم'));
  assert.equal(normalizeAnswerText('كأس–العالم'), normalizeAnswerText('كأس العالم'));
  assert.equal(normalizeAnswerText('كأس—العالم'), normalizeAnswerText('كأس العالم'));
  assert.equal(isCorrectAnswer('كأس-العالم', ['كأس العالم']), true);
});

test('normalize: strip punctuation', () => {
  assert.equal(normalizeAnswerText('القاهرة!!!'), 'القاهرة');
});

test('isCorrectAnswer matches accepted variants', () => {
  assert.equal(isCorrectAnswer('القاهرة', ['القاهرة', 'قاهره']), true);
  assert.equal(isCorrectAnswer('قاهره', ['القاهرة', 'قاهره']), true);
  assert.equal(isCorrectAnswer('الجيزة', ['القاهرة', 'قاهره']), false);
});

test('tryAcceptCorrect twice sync → one winner', () => {
  let match = makeMatch();
  const first = tryAcceptCorrectAnswer(
    () => match,
    (next) => {
      match = next;
    },
    'p2',
    'round-1',
  );
  const second = tryAcceptCorrectAnswer(
    () => match,
    (next) => {
      match = next;
    },
    'p3',
    'round-1',
  );
  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.equal(match.round.winnerPlayerId, 'p2');
});

test('stale roundId rejected', () => {
  let match = makeMatch();
  const stale = tryAcceptCorrectAnswer(
    () => match,
    (next) => {
      match = next;
    },
    'p1',
    'old-round',
  );
  assert.equal(stale.accepted, false);
  assert.equal(stale.reason, 'stale');
  assert.equal(match.round.winnerPlayerId, null);
});

test('wrong answer rejected; correct later accepted', () => {
  const match = makeMatch();
  assert.equal(isCorrectAnswer('غلط', match.round.acceptedAnswers), false);
  assert.equal(isCorrectAnswer('القاهرة', match.round.acceptedAnswers), true);
  let current = match;
  const claim = tryAcceptCorrectAnswer(
    () => current,
    (next) => {
      current = next;
    },
    'p1',
    'round-1',
  );
  assert.equal(claim.accepted, true);
  assert.equal(current.round.winnerPlayerId, 'p1');
});

test('timeout state has no winner and reveals answer', () => {
  const match = withRound(makeMatch(), makeRound({ winnerPlayerId: null, timedOut: true, gamePhase: 'round-results' }));
  assert.equal(match.round.winnerPlayerId, null);
  assert.equal(match.round.timedOut, true);
  assert.equal(revealPrimaryAnswer(match.round.acceptedAnswers), 'القاهرة');
});

test('player view privacy: no acceptedAnswers / revealed answer during question', () => {
  const view = buildFastAnswerPlayerView(makeMatch(), 'p1', makeShell());
  assert.equal(view.gamePhase, 'question');
  assert.equal(view.revealedAnswer, null);
  assert.equal(view.winnerPlayerId, null);
  assert.equal(view.winnerName, null);
  assert.equal(view.timedOut, false);
  assert.equal('acceptedAnswers' in view, false);
  assert.ok(view.question);
  assert.equal(view.categoryLabel, 'بلدان');
  assert.equal(view.roundId, 'round-1');
  assert.equal(view.totalRounds, 5);
  assert.ok(view.deadlineAtMs);
  assert.ok(view.questionDeadlineAtMs);
  assert.equal(view.deadlineAtMs, view.questionDeadlineAtMs);
});

test('spectator cannot submit and sees no answer pre-result', () => {
  const view = buildFastAnswerPlayerView(makeMatch(), 'spectator', makeShell(['p1', 'p2', 'p3']));
  assert.equal(view.isMatchSpectator, true);
  assert.equal(view.canSubmitAnswer, false);
  assert.equal(view.revealedAnswer, null);
  assert.ok(view.question);
});

test('scoring +100 once to winner, 0 others', () => {
  const scored = applyRoundScores(
    withRound(makeMatch(), makeRound({ winnerPlayerId: 'p2', gamePhase: 'round-results' })),
  );
  assert.equal(scored.scores.p2, FAST_ANSWER_WINNER_POINTS);
  assert.equal(scored.scores.p1, 0);
  assert.equal(scored.scores.p3, 0);
  assert.equal(computePlayerRoundPoints(scored, 'p2'), FAST_ANSWER_WINNER_POINTS);
  assert.equal(computePlayerRoundPoints(scored, 'p1'), 0);
  const entries = buildRoundResultEntries(scored);
  assert.equal(entries.find((entry) => entry.playerId === 'p2')?.roundPoints, 100);
  assert.equal(entries.find((entry) => entry.playerId === 'p1')?.roundPoints, 0);
});

test('timeout scoring applies 0 to everyone', () => {
  const scored = applyRoundScores(
    withRound(makeMatch(), makeRound({ winnerPlayerId: null, timedOut: true, gamePhase: 'round-results' })),
  );
  assert.equal(scored.scores.p1, 0);
  assert.equal(scored.scores.p2, 0);
  assert.equal(scored.scores.p3, 0);
});

test('round results continue copy mid vs final', () => {
  const mid = buildFastAnswerPlayerView(
    withRound(makeMatch({ currentRound: 2 }), makeRound({ gamePhase: 'round-results', timedOut: false, winnerPlayerId: 'p1' })),
    'p1',
    makeShell(),
  );
  assert.equal(mid.roundResultsContinueLabel, 'التالي الآن');
  assert.equal(mid.roundResultsWaitingMessage, 'الجولة التالية تبدأ تلقائياً...');

  const final = buildFastAnswerPlayerView(
    withRound(
      makeMatch({ currentRound: 5 }),
      makeRound({ gamePhase: 'round-results', timedOut: false, winnerPlayerId: 'p1' }),
    ),
    'p1',
    makeShell(),
  );
  assert.equal(final.roundResultsContinueLabel, 'عرض النتائج الآن');
  assert.equal(final.roundResultsWaitingMessage, 'سيتم عرض النتائج النهائية تلقائياً...');
});

test('8-player match view builds', () => {
  const ids = Array.from({ length: 8 }, (_, index) => `p${index + 1}`);
  const match = makeMatch({
    playerIds: ids,
    playerNames: Object.fromEntries(ids.map((id) => [id, id])),
    scores: Object.fromEntries(ids.map((id) => [id, 0])),
  });
  const view = buildFastAnswerPlayerView(match, 'p1', makeShell(ids));
  assert.equal(view.leaderboard.length, 8);
  assert.equal(view.canSubmitAnswer, true);
});

test('fixed category picker always returns locked id', () => {
  const pool = ['animals', 'food', 'series', 'games', 'tech'];
  assert.equal(chooseRoundCategoryId('series', [], pool, () => 0), 'series');
  assert.equal(chooseRoundCategoryId('series', ['animals', 'food'], pool, () => 4), 'series');
});

test('random category avoids repeats until pool exhausted', () => {
  const pool = ['a', 'b', 'c', 'd', 'e'];
  const used: string[] = [];

  for (let round = 0; round < 5; round += 1) {
    const id = chooseRoundCategoryId(FAST_ANSWER_RANDOM_CATEGORY_ID, used, pool, () => 0);
    assert.equal(used.includes(id), false);
    used.push(id);
  }

  assert.deepEqual(used, pool);

  const reused = chooseRoundCategoryId(FAST_ANSWER_RANDOM_CATEGORY_ID, used, pool, () => 0);
  assert.equal(reused, 'a');
});

test('random match public view keeps عشوائي while round has internal category', () => {
  const match = makeMatch({
    lockedCategoryId: FAST_ANSWER_RANDOM_CATEGORY_ID,
    lockedCategoryLabel: FAST_ANSWER_RANDOM_CATEGORY_LABEL,
    usedRoundCategoryIds: ['animals'],
    round: makeRound({ categoryId: 'animals' }),
  });
  const view = buildFastAnswerPlayerView(match, 'p1', makeShell());
  assert.equal(view.categoryId, FAST_ANSWER_RANDOM_CATEGORY_ID);
  assert.equal(view.categoryLabel, FAST_ANSWER_RANDOM_CATEGORY_LABEL);
  assert.equal(match.round.categoryId, 'animals');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
