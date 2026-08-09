/**
 * Unit tests for Judge (القاضي).
 * Run: pnpm --filter @wanasatna/server test:judge
 */
import assert from 'node:assert/strict';
import type { GameShellState, JudgeMatchState, JudgeRoundState } from '@wanasatna/shared';
import { JUDGE_WINNER_POINTS } from '@wanasatna/shared';
import { validateSubmittedAnswer } from '../src/modules/game/plugins/judge/answers.js';
import {
  applyRoundScores,
  buildRoundResultEntries,
} from '../src/modules/game/plugins/judge/scoring.js';
import {
  beginJudgingPhase,
  buildJudgePlayerView,
  resolveJudgeForRound,
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

function makeShell(playerIds: string[] = ['p1', 'p2', 'p3', 'p4']): GameShellState {
  return {
    shellId: 'shell-judge',
    roomId: 'room-judge',
    gameId: 'judge',
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

function makeRound(overrides?: Partial<JudgeRoundState>): JudgeRoundState {
  return {
    gamePhase: 'answering',
    phaseRemainingSeconds: 0,
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
  return {
    playerIds: ['p1', 'p2', 'p3', 'p4'],
    playerNames: { p1: 'محمد', p2: 'خالد', p3: 'سارة', p4: 'عبدالله' },
    judgeOrder: ['p2', 'p1', 'p3', 'p4'],
    judgeOrderIndex: 1,
    currentRound: 1,
    totalRounds: 4,
    scores: { p1: 0, p2: 0, p3: 0, p4: 0 },
    matchStatus: 'in-progress',
    recentPromptIds: ['funny-1'],
    round: makeRound(),
    ...overrides,
    round: {
      ...makeRound(),
      ...(overrides?.round ?? {}),
    },
  };
}

function seedAnswers(match: JudgeMatchState): JudgeMatchState {
  let next = match;
  next = submitAnswerToMatch(next, 'p1', 'عذر محمد');
  next = submitAnswerToMatch(next, 'p3', 'عذر سارة');
  next = submitAnswerToMatch(next, 'p4', 'عذر عبدالله');
  return next;
}

test('empty answer rejected', () => {
  assert.equal(validateSubmittedAnswer('  ').ok, false);
});

test('judge cannot submit answer via state guard', () => {
  let match = makeMatch();
  match = submitAnswerToMatch(match, 'p2', 'محاولة قاضي');
  assert.equal(match.round.answers.length, 0);
});

test('non-judge can submit once', () => {
  let match = makeMatch();
  match = submitAnswerToMatch(match, 'p1', 'إجابة');
  match = submitAnswerToMatch(match, 'p1', 'ثانية');
  assert.equal(match.round.answers.length, 1);
  assert.equal(match.round.answers[0]?.text, 'إجابة');
});

test('privacy: answering view hides other answers/owners', () => {
  const match = seedAnswers(makeMatch());
  const view = buildJudgePlayerView(match, 'p1', makeShell());
  assert.equal(view.gamePhase, 'answering');
  assert.equal(view.anonymousAnswers.length, 0);
  assert.equal(view.revealEntries.length, 0);
  assert.equal(JSON.stringify(view).includes('ownerPlayerId'), false);
});

test('begin judging creates shared anonymous order', () => {
  let match = seedAnswers(makeMatch());
  match = beginJudgingPhase(match);
  assert.equal(match.round.gamePhase, 'judging');
  assert.equal(match.round.shuffledAnswerIds.length, 3);
  const shell = makeShell();
  const views = ['p1', 'p2', 'p3', 'p4'].map((id) => buildJudgePlayerView(match, id, shell));
  const first = views[0]!.anonymousAnswers.map((a) => a.answerId).join('|');
  for (const view of views) {
    assert.equal(view.anonymousAnswers.map((a) => a.answerId).join('|'), first);
    assert.ok(view.anonymousAnswers.every((a) => !('ownerPlayerId' in a)));
  }
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

test('scoring +100 once to winner; judge 0', () => {
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
  const results = buildRoundResultEntries(match);
  assert.equal(results.find((r) => r.playerId === 'p3')?.roundPoints, 100);
  assert.equal(results.find((r) => r.playerId === 'p2')?.isJudge, true);
});

test('reveal includes all owner mappings after results phase', () => {
  let match = seedAnswers(makeMatch());
  match = beginJudgingPhase(match);
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
});

test('judge rotation does not immediately repeat when possible', () => {
  const order = ['p1', 'p2', 'p3', 'p4'];
  const first = resolveJudgeForRound(order, 0);
  const second = resolveJudgeForRound(first.nextOrder, first.nextIndex);
  assert.notEqual(first.judgePlayerId, second.judgePlayerId);
});

test('judge view flags isJudge correctly', () => {
  const match = makeMatch();
  const shell = makeShell();
  assert.equal(buildJudgePlayerView(match, 'p2', shell).isJudge, true);
  assert.equal(buildJudgePlayerView(match, 'p1', shell).isJudge, false);
  assert.equal(buildJudgePlayerView(match, 'p1', shell).canSubmitAnswer, true);
  assert.equal(buildJudgePlayerView(match, 'p2', shell).canSubmitAnswer, false);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
