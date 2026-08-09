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
import { FAST_ANSWER_WINNER_POINTS } from '@wanasatna/shared';
import {
  isCorrectAnswer,
  normalizeAnswerText,
  revealPrimaryAnswer,
} from '../src/modules/game/plugins/fast-answer/answers.js';
import {
  applyRoundScores,
  buildRoundResultEntries,
  computePlayerRoundPoints,
} from '../src/modules/game/plugins/fast-answer/scoring.js';
import {
  buildFastAnswerPlayerView,
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
    totalRounds: 5,
    scores: { p1: 0, p2: 0, p3: 0 },
    matchStatus: 'in-progress',
    roundTimeSeconds: 15,
    recentQuestionIds: ['q1'],
    round: makeRound(),
    ...overrides,
    round: {
      ...makeRound(),
      ...(overrides?.round ?? {}),
    },
  };
}

// --- Normalization ---

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

test('normalize: strip punctuation', () => {
  assert.equal(normalizeAnswerText('القاهرة!!!'), 'القاهرة');
  assert.equal(normalizeAnswerText('كأس-العالم؟'), 'كاسالعالم');
});

test('isCorrectAnswer matches accepted variants', () => {
  assert.equal(isCorrectAnswer('القاهرة', ['القاهرة', 'قاهره']), true);
  assert.equal(isCorrectAnswer('قاهره', ['القاهرة', 'قاهره']), true);
  assert.equal(isCorrectAnswer('الجيزة', ['القاهرة', 'قاهره']), false);
});

// --- Concurrent winner ---

test('tryAcceptCorrect twice sync → one winner', () => {
  let match = makeMatch();

  const first = tryAcceptCorrectAnswer(
    () => match,
    (next) => {
      match = next;
    },
    'p2',
  );
  const second = tryAcceptCorrectAnswer(
    () => match,
    (next) => {
      match = next;
    },
    'p3',
  );

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.equal(match.round.winnerPlayerId, 'p2');
});

// --- Wrong then correct ---

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
  );
  assert.equal(claim.accepted, true);
  assert.equal(current.round.winnerPlayerId, 'p1');
});

// --- Timeout / privacy / scoring ---

test('timeout state has no winner and reveals answer', () => {
  const match = makeMatch({
    round: makeRound({
      gamePhase: 'round-results',
      winnerPlayerId: null,
      timedOut: true,
      deadlineAtMs: null,
    }),
  });

  assert.equal(match.round.winnerPlayerId, null);
  assert.equal(match.round.timedOut, true);
  assert.equal(revealPrimaryAnswer(match.round.acceptedAnswers), 'القاهرة');
});

test('player view privacy: no acceptedAnswers / revealed answer during question', () => {
  const match = makeMatch();
  const view = buildFastAnswerPlayerView(match, 'p2', makeShell());

  assert.equal(view.gamePhase, 'question');
  assert.equal(view.revealedAnswer, null);
  assert.equal(view.winnerPlayerId, null);
  assert.equal(view.winnerName, null);
  assert.equal(view.timedOut, false);
  assert.equal('acceptedAnswers' in view, false);
  assert.ok(view.question);
});

test('scoring +100 once to winner, 0 others', () => {
  const open = makeMatch({
    round: makeRound({ winnerPlayerId: 'p2' }),
  });
  const scored = applyRoundScores(open);

  assert.equal(scored.scores.p2, FAST_ANSWER_WINNER_POINTS);
  assert.equal(scored.scores.p1, 0);
  assert.equal(scored.scores.p3, 0);
  assert.equal(computePlayerRoundPoints(scored, 'p2'), FAST_ANSWER_WINNER_POINTS);
  assert.equal(computePlayerRoundPoints(scored, 'p1'), 0);

  const resultsMatch = withRound(scored, {
    ...scored.round,
    gamePhase: 'round-results',
  });
  const entries = buildRoundResultEntries(resultsMatch);
  assert.equal(entries.find((entry) => entry.playerId === 'p2')?.roundPoints, 100);
  assert.equal(entries.find((entry) => entry.playerId === 'p1')?.roundPoints, 0);
});

test('timeout scoring applies 0 to everyone', () => {
  const match = makeMatch({
    round: makeRound({ winnerPlayerId: null, timedOut: true }),
  });
  const scored = applyRoundScores(match);
  assert.equal(scored.scores.p1, 0);
  assert.equal(scored.scores.p2, 0);
  assert.equal(scored.scores.p3, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
