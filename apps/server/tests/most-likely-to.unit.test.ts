import assert from 'node:assert/strict';
import type { GameShellState, MostLikelyToNominee } from '@wanasatna/shared';
import {
  MOST_LIKELY_TO_MAX_PLAYERS,
  MOST_LIKELY_TO_MIN_PLAYERS,
  MOST_LIKELY_TO_QUESTION_COUNT,
  MOST_LIKELY_TO_VOTE_SECONDS,
} from '@wanasatna/shared';
import {
  MOST_LIKELY_TO_PROVISIONAL_QUESTIONS,
  validateMostLikelyToProvisionalQuestions,
} from '../src/modules/game/experimental/most-likely-to/provisional-questions.js';
import { mostLikelyToPluginDefinition } from '../src/modules/game/experimental/most-likely-to/plugin.js';
import {
  buildMostLikelyToPlayerView,
  createMostLikelyToMatch,
  markMostLikelyToPlayerDeparted,
  revealMostLikelyToQuestion,
  selectMostLikelyToQuestions,
  settleMostLikelyToDeadline,
  startNextMostLikelyToQuestion,
  voteMostLikelyTo,
  type MostLikelyToMatchState,
} from '../src/modules/game/experimental/most-likely-to/state.js';

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
    console.error(error);
  }
}

function seeded(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function participants(count = 4): MostLikelyToNominee[] {
  return Array.from({ length: count }, (_, index) => ({
    playerId: `player-${index + 1}`,
    name: `لاعب ${index + 1}`,
  }));
}

function match(count = 4, seed = 1, now = 1_000): MostLikelyToMatchState {
  return createMostLikelyToMatch({ participants: participants(count), random: seeded(seed), now });
}

function shell(current: MostLikelyToMatchState, hostPlayerId = 'player-1'): GameShellState {
  return {
    shellId: 'shell-1',
    roomId: 'room-1',
    gameId: 'most-likely-to',
    phase: 'PLAYING',
    hostPlayerId,
    players: current.playerIds.map((playerId) => ({
      id: playerId,
      name: current.playerNames[playerId]!,
      isHost: playerId === hostPlayerId,
      isConnected: true,
      isReady: true,
      isSpectator: false,
    })),
    readyPlayerIds: [],
    countdownSeconds: 1,
    countdownRemainingSeconds: null,
    gameTimerSeconds: null,
    gameTimerRemainingSeconds: null,
    startedAt: new Date(0).toISOString(),
    finishedAt: null,
    updatedAt: new Date(0).toISOString(),
    matchParticipantIds: [...current.playerIds],
  };
}

function vote(
  current: MostLikelyToMatchState,
  voter: string,
  nominee: string,
  requestId: string,
  now = 2_000,
): MostLikelyToMatchState {
  const result = voteMostLikelyTo(
    current,
    voter,
    {
      questionId: current.currentQuestion.questionId,
      nomineePlayerId: nominee,
      requestId,
    },
    now,
  );
  assert.equal(result.ok, true);
  return result.ok ? result.match : current;
}

test('provisional content is exactly the approved ten unique Arabic questions', () => {
  assert.deepEqual(validateMostLikelyToProvisionalQuestions(), []);
  assert.equal(MOST_LIKELY_TO_PROVISIONAL_QUESTIONS.length, 10);
  assert.equal(new Set(MOST_LIKELY_TO_PROVISIONAL_QUESTIONS.map((entry) => entry.id)).size, 10);
  assert.equal(new Set(MOST_LIKELY_TO_PROVISIONAL_QUESTIONS.map((entry) => entry.text)).size, 10);
  assert.match(MOST_LIKELY_TO_PROVISIONAL_QUESTIONS[0]!.text, /^مين أكثر واحد/);
});

test('a match uses ten questions without replacement and only changes their order', () => {
  const first = selectMostLikelyToQuestions(seeded(1));
  const second = selectMostLikelyToQuestions(seeded(2));
  assert.equal(first.length, MOST_LIKELY_TO_QUESTION_COUNT);
  assert.equal(new Set(first.map((entry) => entry.id)).size, MOST_LIKELY_TO_QUESTION_COUNT);
  assert.deepEqual(
    first.map((entry) => entry.id).sort(),
    MOST_LIKELY_TO_PROVISIONAL_QUESTIONS.map((entry) => entry.id).sort(),
  );
  assert.notDeepEqual(
    first.map((entry) => entry.id),
    second.map((entry) => entry.id),
  );
});

test('start accepts 3 and 15 participants and rejects 2, 16, and duplicate identities', () => {
  assert.equal(match(MOST_LIKELY_TO_MIN_PLAYERS).playerIds.length, 3);
  assert.equal(match(MOST_LIKELY_TO_MAX_PLAYERS).playerIds.length, 15);
  assert.throws(() => match(2));
  assert.throws(() => match(16));
  const duplicate = participants(3);
  duplicate[2] = { ...duplicate[2]!, playerId: duplicate[0]!.playerId };
  assert.throws(() => createMostLikelyToMatch({ participants: duplicate }));
});

test('plugin start validation enforces connected nonspectator participant boundaries', () => {
  const context = (count: number) => ({
    roomId: 'room-1',
    hostPlayerId: 'player-1',
    players: participants(count).map((entry) => ({
      id: entry.playerId,
      name: entry.name,
      isHost: entry.playerId === 'player-1',
      isConnected: true,
      isReady: true,
      isSpectator: false,
    })),
    settings: {},
  });
  assert.equal(mostLikelyToPluginDefinition.validateStart?.(context(2)).success, false);
  assert.equal(mostLikelyToPluginDefinition.validateStart?.(context(3)).success, true);
  assert.equal(mostLikelyToPluginDefinition.validateStart?.(context(15)).success, true);
  assert.equal(mostLikelyToPluginDefinition.validateStart?.(context(16)).success, false);
});

test('public views expose the current question but never future questions', () => {
  const current = match();
  const view = buildMostLikelyToPlayerView(current, 'player-1', shell(current), 1_000);
  assert.equal(view.question, current.currentQuestion.text);
  const serialized = JSON.stringify(view);
  for (const future of current.questions.slice(1)) {
    assert.equal(serialized.includes(future.text), false);
  }
  assert.equal(view.recap.length, 0);
  assert.equal(view.result, null);
});

test('self-vote is allowed and the latest confirmed vote replaces the prior vote', () => {
  let current = match();
  current = vote(current, 'player-1', 'player-1', 'self-vote-0001');
  current = vote(current, 'player-1', 'player-2', 'change-vote-01');
  assert.deepEqual(current.currentQuestion.votesByVoterId, { 'player-1': 'player-2' });
  const revealed = revealMostLikelyToQuestion(current);
  assert.equal(revealed.history[0]!.totalVotes, 1);
  assert.equal(
    revealed.history[0]!.nominees.find((entry) => entry.playerId === 'player-2')?.voteCount,
    1,
  );
  assert.equal(
    revealed.history[0]!.nominees.find((entry) => entry.playerId === 'player-1')?.voteCount,
    0,
  );
});

test('in-progress views reveal only the viewer own selection and public progress count', () => {
  let current = match();
  current = vote(current, 'player-1', 'player-2', 'private-vote-01');
  const hostView = buildMostLikelyToPlayerView(current, 'player-1', shell(current));
  const otherView = buildMostLikelyToPlayerView(current, 'player-2', shell(current));
  const spectatorView = buildMostLikelyToPlayerView(current, 'spectator', shell(current));
  assert.equal(hostView.ownVotePlayerId, 'player-2');
  assert.equal(otherView.ownVotePlayerId, null);
  assert.equal(spectatorView.ownVotePlayerId, null);
  assert.equal(otherView.submittedVoteCount, 1);
  assert.equal(spectatorView.canVote, false);
  for (const view of [hostView, otherView, spectatorView]) {
    assert.equal(view.result, null);
    assert.equal(JSON.stringify(view).includes('votesByVoterId'), false);
    assert.equal(JSON.stringify(view).includes('لاعب 1'), true);
  }
});

test('all final votes reveal immediately and close further changes', () => {
  let current = match(3);
  current = vote(current, 'player-1', 'player-2', 'all-vote-0001');
  current = vote(current, 'player-2', 'player-2', 'all-vote-0002');
  current = vote(current, 'player-3', 'player-1', 'all-vote-0003');
  assert.equal(current.phase, 'reveal');
  assert.equal(current.currentQuestion.deadlineAtMs, null);
  const late = voteMostLikelyTo(current, 'player-1', {
    questionId: current.currentQuestion.questionId,
    nomineePlayerId: 'player-3',
    requestId: 'late-vote-001',
  });
  assert.equal(late.ok, false);
});

test('the absolute deadline rejects a late vote before the delayed timer callback runs', () => {
  const current = match(3, 1, 1_000);
  assert.equal(current.currentQuestion.deadlineAtMs, 1_000 + MOST_LIKELY_TO_VOTE_SECONDS * 1_000);
  const late = voteMostLikelyTo(
    current,
    'player-1',
    {
      questionId: current.currentQuestion.questionId,
      nomineePlayerId: 'player-2',
      requestId: 'after-deadline1',
    },
    current.currentQuestion.deadlineAtMs!,
  );
  assert.equal(late.ok, false);
  assert.equal(
    settleMostLikelyToDeadline(current, current.currentQuestion.deadlineAtMs! - 1),
    current,
  );
  assert.equal(
    settleMostLikelyToDeadline(current, current.currentQuestion.deadlineAtMs!).phase,
    'reveal',
  );
});

test('timeout reveals partial votes and handles a zero-vote question without crowns', () => {
  let partial = match(3);
  partial = vote(partial, 'player-1', 'player-2', 'partial-vote01');
  partial = settleMostLikelyToDeadline(partial, partial.currentQuestion.deadlineAtMs!);
  assert.equal(partial.history[0]!.totalVotes, 1);
  assert.deepEqual(partial.history[0]!.topNomineePlayerIds, ['player-2']);

  const noVotes = match(3);
  const settled = settleMostLikelyToDeadline(noVotes, noVotes.currentQuestion.deadlineAtMs!);
  assert.equal(settled.history[0]!.totalVotes, 0);
  assert.deepEqual(settled.history[0]!.topNomineePlayerIds, []);
  assert.ok(settled.history[0]!.nominees.every((entry) => entry.voteCount === 0));
});

test('named disclosures, counts, and every positive tie are public only after reveal', () => {
  let current = match(4);
  current = vote(current, 'player-1', 'player-1', 'tie-vote-0001');
  current = vote(current, 'player-2', 'player-2', 'tie-vote-0002');
  current = vote(current, 'player-3', 'player-1', 'tie-vote-0003');
  current = vote(current, 'player-4', 'player-2', 'tie-vote-0004');
  const result = current.history[0]!;
  assert.deepEqual(result.topNomineePlayerIds, ['player-1', 'player-2']);
  assert.equal(result.votes.length, 4);
  assert.deepEqual(result.nominees.find((entry) => entry.playerId === 'player-1')?.voterNames, [
    'لاعب 1',
    'لاعب 3',
  ]);
  const view = buildMostLikelyToPlayerView(current, 'spectator', shell(current));
  assert.equal(view.result?.votes[0]?.voterName, 'لاعب 1');
  assert.equal(view.ownVotePlayerId, null);
});

test('duplicate delivery is idempotent and wrong-question payloads cannot mutate state', () => {
  const current = match(3);
  const first = voteMostLikelyTo(
    current,
    'player-1',
    {
      questionId: current.currentQuestion.questionId,
      nomineePlayerId: 'player-2',
      requestId: 'duplicate-0001',
    },
    2_000,
  );
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const duplicate = voteMostLikelyTo(
    first.match,
    'player-1',
    {
      questionId: current.currentQuestion.questionId,
      nomineePlayerId: 'player-3',
      requestId: 'duplicate-0001',
    },
    2_001,
  );
  assert.equal(duplicate.ok && duplicate.changed, false);
  assert.equal(
    duplicate.ok && duplicate.match.currentQuestion.votesByVoterId['player-1'],
    'player-2',
  );
  const wrongQuestion = voteMostLikelyTo(
    first.match,
    'player-2',
    {
      questionId: 'old-question',
      nomineePlayerId: 'player-3',
      requestId: 'wrong-question1',
    },
    2_002,
  );
  assert.equal(wrongQuestion.ok, false);
});

test('join waits for the next question while disconnect keeps the stable current roster', () => {
  let current = match(3);
  const originalRoster = current.currentQuestion.roster.map((entry) => entry.playerId);
  const disconnectedView = buildMostLikelyToPlayerView(current, 'player-2', shell(current));
  assert.equal(disconnectedView.canVote, true);
  const waiting = buildMostLikelyToPlayerView(current, 'player-4', shell(current));
  assert.equal(waiting.canVote, false);
  assert.equal(waiting.isWaitingForNextQuestion, true);
  assert.deepEqual(
    current.currentQuestion.roster.map((entry) => entry.playerId),
    originalRoster,
  );

  current = revealMostLikelyToQuestion(current);
  const advanced = startNextMostLikelyToQuestion(
    current,
    participants(4),
    'next-with-join1',
    50_000,
  );
  assert.equal(advanced.ok, true);
  assert.equal(advanced.ok && advanced.match.currentQuestion.roster.length, 4);
});

test('permanent departure keeps the current question intact and removes later eligibility', () => {
  let current = match(4);
  const questionId = current.currentQuestion.questionId;
  current = vote(current, 'player-4', 'player-1', 'departed-vote1');
  current = markMostLikelyToPlayerDeparted(current, 'player-4');
  assert.equal(current.currentQuestion.questionId, questionId);
  assert.equal(current.currentQuestion.votesByVoterId['player-4'], 'player-1');
  assert.ok(current.currentQuestion.roster.some((entry) => entry.playerId === 'player-4'));
  current = revealMostLikelyToQuestion(current);
  const advanced = startNextMostLikelyToQuestion(
    current,
    participants(4),
    'next-departure1',
    50_000,
  );
  assert.equal(advanced.ok, true);
  assert.equal(
    advanced.ok &&
      advanced.match.currentQuestion.roster.some((entry) => entry.playerId === 'player-4'),
    false,
  );
});

test('current host alone receives advance control and host transfer updates it', () => {
  const revealed = revealMostLikelyToQuestion(match(3));
  assert.equal(buildMostLikelyToPlayerView(revealed, 'player-1', shell(revealed)).canAdvance, true);
  assert.equal(
    buildMostLikelyToPlayerView(revealed, 'player-2', shell(revealed)).canAdvance,
    false,
  );
  assert.equal(
    buildMostLikelyToPlayerView(revealed, 'player-2', shell(revealed, 'player-2')).canAdvance,
    true,
  );
});

test('question ten completes exactly and recap aggregate has no invented winner field', () => {
  let current = match(3);
  for (let index = 0; index < MOST_LIKELY_TO_QUESTION_COUNT; index += 1) {
    current = vote(current, 'player-1', 'player-2', `round-vote-${index}-a`);
    current = vote(current, 'player-2', 'player-2', `round-vote-${index}-b`);
    current = vote(current, 'player-3', 'player-1', `round-vote-${index}-c`);
    if (index < MOST_LIKELY_TO_QUESTION_COUNT - 1) {
      const next = startNextMostLikelyToQuestion(
        current,
        participants(3),
        `round-next-${index}`,
        50_000 + index,
      );
      assert.equal(next.ok, true);
      if (next.ok) current = next.match;
    }
  }
  assert.equal(current.phase, 'completed');
  assert.equal(current.history.length, 10);
  const view = buildMostLikelyToPlayerView(current, 'player-1', shell(current));
  assert.equal(view.recap.length, 10);
  assert.equal(view.aggregate?.totalVotes, 30);
  assert.deepEqual(view.aggregate?.topNomineePlayerIds, ['player-2']);
  assert.equal('winnerPlayerId' in (view.aggregate ?? {}), false);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
