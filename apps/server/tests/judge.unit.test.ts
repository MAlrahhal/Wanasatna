/**
 * Unit tests for Judge (القاضي) — P4.7 production polish.
 * Run: pnpm --filter @wanasatna/server test:judge
 */
import assert from 'node:assert/strict';
import type { GameShellState, JudgeMatchState, JudgeRoundState } from '@wanasatna/shared';
import {
  JUDGE_ANSWERING_SECONDS,
  JUDGE_JUDGING_SECONDS,
  JUDGE_MAX_ANSWER_LENGTH,
  JUDGE_ROUND_RESULTS_SECONDS,
  JUDGE_WINNER_POINTS,
  buildRoundResultsContinueCopy,
} from '@wanasatna/shared';
import { createOpaqueAnswerId, validateSubmittedAnswer } from '../src/modules/game/plugins/judge/answers.js';
import { JUDGE_RANDOM_CATEGORY_ID, chooseRoundCategoryId } from '../src/modules/game/plugins/judge/prompts.js';
import {
  applyRoundScores,
  buildRoundResultEntries,
} from '../src/modules/game/plugins/judge/scoring.js';
import {
  allRequiredHaveAnswered,
  beginJudgingPhase,
  buildJudgePlayerView,
  createJudgeOrder,
  markPlayerDeparted,
  resolveNextRoundJudge,
  submitAnswerToMatch,
  trySelectWinner,
  withRound,
} from '../src/modules/game/plugins/judge/state.js';

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

function makeShell(
  playerIds: string[] = ['p1', 'p2', 'p3', 'p4'],
  connectedIds = playerIds,
): GameShellState {
  const connected = new Set(connectedIds);
  return {
    shellId: 'shell-judge',
    roomId: 'room-judge',
    gameId: 'judge',
    phase: 'PLAYING',
    hostPlayerId: 'p1',
    players: playerIds.map((id, index) => ({
      id,
      name: ['محمد', 'خالد', 'سارة', 'عبدالله', 'فهد', 'نورة', 'عمر', 'ريم'][index] ?? `لاعب${index}`,
      isConnected: connected.has(id),
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

function makeRound(overrides?: Partial<JudgeRoundState>): JudgeRoundState {
  return {
    roundId: 'round-1',
    gamePhase: 'answering',
    phaseRemainingSeconds: JUDGE_ANSWERING_SECONDS,
    deadlineAtMs: Date.now() + JUDGE_ANSWERING_SECONDS * 1000,
    judgePlayerId: 'p2',
    promptId: 'funny-1',
    prompt: 'وش أسوأ عذر؟',
    categoryId: 'funny',
    answers: [],
    shuffledAnswerIds: [],
    winningAnswerId: null,
    ...overrides,
  };
}

function makeMatch(overrides?: Partial<JudgeMatchState>): JudgeMatchState {
  const playerIds = overrides?.playerIds ?? ['p1', 'p2', 'p3', 'p4'];
  return {
    playerIds,
    playerNames: {
      p1: 'محمد',
      p2: 'خالد',
      p3: 'سارة',
      p4: 'عبدالله',
      p5: 'فهد',
      p6: 'نورة',
      p7: 'عمر',
      p8: 'ريم',
    },
    judgeOrder: playerIds,
    judgeOrderIndex: 0,
    currentRound: 1,
    totalRounds: playerIds.length,
    scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
    matchStatus: 'in-progress',
    lockedCategoryId: 'funny',
    lockedCategoryLabel: 'مواقف مضحكة',
    usedRoundCategoryIds: ['funny'],
    departedPlayerIds: [],
    recentPromptIds: ['funny-1'],
    ...overrides,
    round: {
      ...makeRound(),
      ...(overrides?.round ?? {}),
    },
  };
}

function seedAnswers(match: JudgeMatchState): JudgeMatchState {
  let next = match;
  for (const playerId of match.playerIds) {
    if (playerId === match.round.judgePlayerId) {
      continue;
    }
    next = submitAnswerToMatch(next, playerId, `إجابة ${playerId}`);
  }
  return next;
}

test('empty answer rejected', () => {
  assert.equal(validateSubmittedAnswer('  ').ok, false);
});

test('max 150 characters enforced', () => {
  assert.equal(validateSubmittedAnswer('أ'.repeat(JUDGE_MAX_ANSWER_LENGTH)).ok, true);
  assert.equal(validateSubmittedAnswer('أ'.repeat(JUDGE_MAX_ANSWER_LENGTH + 1)).ok, false);
});

test('judge cannot submit answer via state guard', () => {
  let match = makeMatch();
  match = submitAnswerToMatch(match, 'p2', 'محاولة قاضي');
  assert.equal(match.round.answers.length, 0);
});

test('non-judge can submit once; duplicate rejected', () => {
  let match = makeMatch();
  match = submitAnswerToMatch(match, 'p1', 'إجابة');
  match = submitAnswerToMatch(match, 'p1', 'ثانية');
  assert.equal(match.round.answers.length, 1);
  assert.equal(match.round.answers[0]?.text, 'إجابة');
});

test('identical answers are allowed', () => {
  let match = makeMatch();
  match = submitAnswerToMatch(match, 'p1', 'نفس النص');
  match = submitAnswerToMatch(match, 'p3', 'نفس النص');
  assert.equal(match.round.answers.length, 2);
});

test('3 players → exactly 3 rounds; 8 players → exactly 8 rounds', () => {
  assert.equal(makeMatch({ playerIds: ['p1', 'p2', 'p3'] }).totalRounds, 3);
  assert.equal(
    makeMatch({ playerIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'] }).totalRounds,
    8,
  );
});

test('judge order contains each participant exactly once', () => {
  const ids = ['p1', 'p2', 'p3', 'p4', 'p5'];
  const order = createJudgeOrder(ids);
  assert.equal(order.length, 5);
  assert.equal(new Set(order).size, 5);
  assert.deepEqual([...order].sort(), [...ids].sort());
});

test('judge rotation consumes order sequentially without reshuffle', () => {
  const match = makeMatch({
    playerIds: ['p1', 'p2', 'p3'],
    judgeOrder: ['p1', 'p2', 'p3'],
    judgeOrderIndex: 0,
    round: makeRound({ judgePlayerId: 'p1' }),
  });
  const judges = [match.round.judgePlayerId];
  let current = match;
  while (true) {
    const next = resolveNextRoundJudge(current);
    if (!next) {
      break;
    }
    judges.push(next.judgePlayerId);
    current = { ...current, judgeOrderIndex: next.nextIndex };
  }
  assert.deepEqual(judges, ['p1', 'p2', 'p3']);
  assert.equal(new Set(judges).size, 3);
});

test('no duplicate judge while walking a 3-player order', () => {
  const match = makeMatch({
    playerIds: ['p1', 'p2', 'p3'],
    judgeOrder: ['p3', 'p1', 'p2'],
    judgeOrderIndex: 0,
    round: makeRound({ judgePlayerId: 'p3' }),
  });
  const judges = [match.round.judgePlayerId];
  let current = match;
  while (true) {
    const next = resolveNextRoundJudge(current);
    if (!next) {
      break;
    }
    judges.push(next.judgePlayerId);
    current = { ...current, judgeOrderIndex: next.nextIndex };
  }
  assert.deepEqual(judges, ['p3', 'p1', 'p2']);
  assert.equal(new Set(judges).size, 3);
});

test('permanent leave skips future judge turn', () => {
  const match = markPlayerDeparted(
    makeMatch({
      judgeOrder: ['p2', 'p1', 'p3', 'p4'],
      judgeOrderIndex: 0,
      round: makeRound({ judgePlayerId: 'p2' }),
    }),
    'p1',
  );
  const next = resolveNextRoundJudge(match);
  assert.equal(next?.judgePlayerId, 'p3');
});

test('fixed category always returns the locked id', () => {
  assert.equal(chooseRoundCategoryId('funny', ['daily'], ['funny', 'daily', 'weird'], () => 1), 'funny');
});

test('random prefers unused category before reuse', () => {
  const pool = ['funny', 'daily', 'weird'];
  const first = chooseRoundCategoryId(JUDGE_RANDOM_CATEGORY_ID, [], pool, () => 0);
  assert.equal(first, 'funny');
  const second = chooseRoundCategoryId(JUDGE_RANDOM_CATEGORY_ID, ['funny'], pool, () => 0);
  assert.equal(second, 'daily');
  const reused = chooseRoundCategoryId(
    JUDGE_RANDOM_CATEGORY_ID,
    ['funny', 'daily', 'weird'],
    pool,
    () => 1,
  );
  assert.equal(reused, 'daily');
});

test('AFK connected player does not count as submitted; disconnected does not stall', () => {
  const match = submitAnswerToMatch(makeMatch(), 'p1', 'إجابة محمد');
  assert.equal(allRequiredHaveAnswered(match, makeShell(['p1', 'p2', 'p3', 'p4'])), false);
  assert.equal(allRequiredHaveAnswered(match, makeShell(['p1', 'p2', 'p3', 'p4'], ['p1', 'p2'])), true);
});

test('privacy: answering view hides other answers/owners', () => {
  const match = seedAnswers(makeMatch());
  const view = buildJudgePlayerView(match, 'p1', makeShell());
  assert.equal(view.gamePhase, 'answering');
  assert.equal(view.anonymousAnswers.length, 0);
  assert.equal(view.revealEntries.length, 0);
  assert.equal(JSON.stringify(view).includes('ownerPlayerId'), false);
  assert.equal(view.categoryLabel, 'مواقف مضحكة');
  assert.equal(view.roundId, 'round-1');
});

test('begin judging creates shared anonymous order; owners hidden', () => {
  let match = seedAnswers(makeMatch());
  match = beginJudgingPhase(match);
  assert.equal(match.round.gamePhase, 'judging');
  assert.equal(match.round.shuffledAnswerIds.length, 3);
  assert.ok(match.round.deadlineAtMs);
  const shell = makeShell();
  const views = ['p1', 'p2', 'p3', 'p4'].map((id) => buildJudgePlayerView(match, id, shell));
  const first = views[0]!.anonymousAnswers.map((a) => a.answerId).join('|');
  for (const view of views) {
    assert.equal(view.anonymousAnswers.map((a) => a.answerId).join('|'), first);
    assert.ok(view.anonymousAnswers.every((a) => !('ownerPlayerId' in a)));
    assert.equal(JSON.stringify(view).includes('ownerPlayerId'), false);
  }
});

test('opaque answer ids do not encode player identity', () => {
  const id = createOpaqueAnswerId();
  assert.match(id, /^ans_[a-f0-9]+$/);
  assert.equal(id.includes('p1'), false);
});

test('judge can select; non-judge canSelectWinner false', () => {
  let match = seedAnswers(makeMatch());
  match = beginJudgingPhase(match);
  const shell = makeShell();
  assert.equal(buildJudgePlayerView(match, 'p2', shell).canSelectWinner, true);
  assert.equal(buildJudgePlayerView(match, 'p1', shell).canSelectWinner, false);
});

test('trySelectWinner once — double select rejected', () => {
  let match = seedAnswers(makeMatch());
  match = beginJudgingPhase(match);
  const answerId = match.round.shuffledAnswerIds[0]!;

  const first = trySelectWinner(
    () => match,
    (next) => {
      match = next;
    },
    'p2',
    answerId,
  );
  const second = trySelectWinner(
    () => match,
    (next) => {
      match = next;
    },
    'p2',
    answerId,
  );

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.equal(match.round.winningAnswerId, answerId);
});

test('invalid winner id rejected', () => {
  let match = seedAnswers(makeMatch());
  match = beginJudgingPhase(match);
  const claim = trySelectWinner(
    () => match,
    (next) => {
      match = next;
    },
    'p2',
    'ans_missing',
  );
  assert.equal(claim.accepted, false);
});

test('scoring +100 once to winner; judge 0; others 0', () => {
  let match = seedAnswers(makeMatch());
  match = beginJudgingPhase(match);
  const ans = match.round.answers.find((a) => a.ownerPlayerId === 'p3')!;
  match = withRound(match, {
    ...match.round,
    winningAnswerId: ans.answerId,
  });
  match = applyRoundScores(match);
  assert.equal(match.scores.p3, JUDGE_WINNER_POINTS);
  assert.equal(match.scores.p2, 0);
  assert.equal(match.scores.p1, 0);
  const results = buildRoundResultEntries(match);
  assert.equal(results.find((r) => r.playerId === 'p3')?.roundPoints, 100);
  assert.equal(results.find((r) => r.playerId === 'p2')?.isJudge, true);
});

test('judge timeout / no winner awards 0', () => {
  let match = seedAnswers(makeMatch());
  match = beginJudgingPhase(match);
  match = applyRoundScores(match);
  assert.equal(match.scores.p1, 0);
  assert.equal(match.scores.p3, 0);
});

test('duplicate applyRoundScores after results does not double', () => {
  let match = seedAnswers(makeMatch());
  match = beginJudgingPhase(match);
  const ans = match.round.answers[0]!;
  match = withRound(match, { ...match.round, winningAnswerId: ans.answerId });
  match = applyRoundScores(match);
  const afterFirst = match.scores[ans.ownerPlayerId];
  match = withRound(match, { ...match.round, gamePhase: 'round-results' });
  match = applyRoundScores(match);
  assert.equal(match.scores[ans.ownerPlayerId], afterFirst);
});

test('reveal includes owner mappings after results; spectator hidden before', () => {
  let match = seedAnswers(makeMatch());
  match = beginJudgingPhase(match);
  const spectator = buildJudgePlayerView(match, 'spectator', makeShell());
  assert.equal(spectator.isMatchSpectator, true);
  assert.equal(spectator.canSubmitAnswer, false);
  assert.equal(spectator.canSelectWinner, false);
  assert.equal(JSON.stringify(spectator).includes('ownerPlayerId'), false);

  const ans = match.round.answers[0]!;
  match = withRound(match, {
    ...match.round,
    winningAnswerId: ans.answerId,
    gamePhase: 'round-results',
  });
  match = applyRoundScores(match);
  const view = buildJudgePlayerView(match, 'p1', makeShell());
  assert.equal(view.revealEntries.length, 3);
  assert.ok(view.revealEntries.every((e) => typeof e.ownerName === 'string'));
  assert.ok(view.winningAnswerText);
  assert.equal(view.roundResultsContinueLabel, 'التالي الآن');
});

test('final-round continue copy uses final path', () => {
  const copy = buildRoundResultsContinueCopy({ isFinalRound: true, isHost: true });
  assert.equal(copy.roundResultsWaitingMessage, 'سيتم عرض النتائج النهائية تلقائياً...');
  assert.equal(copy.roundResultsContinueLabel, 'عرض النتائج الآن');
});

test('timer constants match production contract', () => {
  assert.equal(JUDGE_ANSWERING_SECONDS, 60);
  assert.equal(JUDGE_JUDGING_SECONDS, 30);
  assert.equal(JUDGE_ROUND_RESULTS_SECONDS, 10);
});

test('judge view flags isJudge correctly', () => {
  const match = makeMatch({
    judgeOrder: ['p2', 'p1', 'p3', 'p4'],
    judgeOrderIndex: 0,
    round: makeRound({ judgePlayerId: 'p2' }),
  });
  const shell = makeShell();
  assert.equal(buildJudgePlayerView(match, 'p2', shell).isJudge, true);
  assert.equal(buildJudgePlayerView(match, 'p1', shell).isJudge, false);
  assert.equal(buildJudgePlayerView(match, 'p1', shell).canSubmitAnswer, true);
  assert.equal(buildJudgePlayerView(match, 'p2', shell).canSubmitAnswer, false);
});

test('random public category label stays عشوائي on the view', () => {
  const match = makeMatch({
    lockedCategoryId: JUDGE_RANDOM_CATEGORY_ID,
    lockedCategoryLabel: 'عشوائي',
    round: makeRound({ categoryId: 'daily' }),
  });
  const view = buildJudgePlayerView(match, 'p1', makeShell());
  assert.equal(view.categoryId, JUDGE_RANDOM_CATEGORY_ID);
  assert.equal(view.categoryLabel, 'عشوائي');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
