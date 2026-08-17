/**
 * Unit tests for Bara AlSalafa pure game logic.
 * Run: pnpm --filter @wanasatna/server exec tsx tests/unit.test.ts
 */
import assert from 'node:assert/strict';
import type { BaraAlSalafaMatchState, GameShellState } from '@wanasatna/shared';
import {
  buildDirectedQuestionPairsFromOrder,
  buildSpeakingOrder,
  DirectedQuestionPairsBuildError,
} from '../src/modules/game/plugins/bara-al-salafa/speaking-order.js';
import {
  applyRoundScores,
  buildResultsLeaderboardEntries,
  computePlayerRoundPoints,
} from '../src/modules/game/plugins/bara-al-salafa/scoring.js';
import { applyVote, haveAllConnectedParticipantsVoted } from '../src/modules/game/plugins/bara-al-salafa/voting.js';
import {
  applyRoleUnderstood,
  haveAllConnectedParticipantsAcknowledgedRole,
} from '../src/modules/game/plugins/bara-al-salafa/role-understood.js';
import { buildBaraAlSalafaPlayerView, buildBaraAlSalafaSpectatorView } from '../src/modules/game/plugins/bara-al-salafa/state.js';
import {
  buildImpostorGuessOptions,
  pickRandomWordFromCategories,
  BARA_AL_SALAFA_DEFAULT_ROUNDS,
  BARA_AL_SALAFA_ROLE_REVEAL_DURATION_SECONDS,
  BARA_AL_SALAFA_VOTING_DURATION_SECONDS,
  BARA_AL_SALAFA_IMPOSTOR_GUESS_DURATION_SECONDS,
  BARA_AL_SALAFA_QUESTION_TURN_DURATION_SECONDS,
  BARA_AL_SALAFA_ROUND_RESULTS_DURATION_SECONDS,
  BARA_AL_SALAFA_MATCH_RESULTS_DURATION_SECONDS,
  MAX_ROOM_PLAYERS,
} from '@wanasatna/shared';
import { resolveTotalRounds } from '../src/modules/game/plugins/bara-al-salafa/round-state.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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

function makeMatch(overrides?: Partial<BaraAlSalafaMatchState['round']>): BaraAlSalafaMatchState {
  return {
    playerIds: ['p1', 'p2', 'p3'],
    playerNames: { p1: 'محمد', p2: 'خالد', p3: 'علي' },
    currentRound: 1,
    totalRounds: 3,
    scores: { p1: 0, p2: 0, p3: 0 },
    matchStatus: 'in-progress',
    usedWordTexts: ['مكة'],
    round: {
      word: 'مكة',
      wordCategoryId: 'places',
      categoryName: 'أماكن',
      impostorPlayerId: 'p2',
      gamePhase: 'description',
      phaseRemainingSeconds: 20,
      deadlineAtMs: Date.now() + 20_000,
      descriptionDurationSeconds: 20,
      questionTurnDurationSeconds: 60,
      speakingOrder: [],
      directedQuestionPairs: [],
      currentSpeakerIndex: 0,
      activeFreeQuestionPlayerId: null,
      pendingFreeQuestionTargetPlayerId: null,
      completedFreeQuestionTurns: [],
      votes: {},
      submittedVoterIds: [],
      votingDurationSeconds: 60,
      revealDurationSeconds: 5,
      impostorGuessOptions: [],
      impostorGuessDurationSeconds: 60,
      selectedWord: null,
      guessedCorrectly: null,
      roleUnderstoodPlayerIds: [],
      roundResultsDurationSeconds: 10,
      guessResultDurationSeconds: 3,
      ...overrides,
    },
  };
}

function makeShell(): GameShellState {
  return {
    shellId: 'shell-1',
    roomId: 'room-1',
    gameId: 'bara-al-salafa',
    phase: 'PLAYING',
    hostPlayerId: 'p1',
    players: [
      { id: 'p1', name: 'محمد', isHost: true, isConnected: true, isReady: false },
      { id: 'p2', name: 'خالد', isHost: false, isConnected: true, isReady: false },
      { id: 'p3', name: 'علي', isHost: false, isConnected: true, isReady: false },
    ],
    readyPlayerIds: [],
    countdownSeconds: 3,
    countdownRemainingSeconds: null,
    gameTimerSeconds: 60,
    gameTimerRemainingSeconds: null,
    startedAt: null,
    finishedAt: null,
    updatedAt: new Date().toISOString(),
    matchParticipantIds: ['p1', 'p2', 'p3'],
  };
}

// --- Directed question pairing ---

test('directed pairs: every player asks once, is targeted once, no self-pairs (sizes 2-8)', () => {
  for (let size = 2; size <= 8; size += 1) {
    for (let run = 0; run < 50; run += 1) {
      const ids = Array.from({ length: size }, (_, i) => `player-${i}`);
      const order = buildSpeakingOrder(ids);
      const pairs = buildDirectedQuestionPairsFromOrder(order);

      assert.equal(pairs.length, size);
      const askers = new Set(pairs.map((p) => p.askerPlayerId));
      const targets = new Set(pairs.map((p) => p.targetPlayerId));
      assert.equal(askers.size, size, 'each player asks exactly once');
      assert.equal(targets.size, size, 'each player is targeted exactly once');
      for (const pair of pairs) {
        assert.notEqual(pair.askerPlayerId, pair.targetPlayerId, 'no self-pair');
      }
    }
  }
});

test('directed pairs: throws for fewer than 2 players', () => {
  assert.throws(() => buildDirectedQuestionPairsFromOrder(['solo']), DirectedQuestionPairsBuildError);
  assert.throws(() => buildDirectedQuestionPairsFromOrder([]), DirectedQuestionPairsBuildError);
});

test('directed pairs: throws for duplicate order entries', () => {
  assert.throws(
    () => buildDirectedQuestionPairsFromOrder(['a', 'b', 'a']),
    DirectedQuestionPairsBuildError,
  );
});

// --- Scoring ---

test('scoring: correct voter +100, impostor correct guess +100, wrong voter +0', () => {
  const match = makeMatch({
    votes: { p1: 'p2', p3: 'p1' },
    guessedCorrectly: true,
  });

  assert.equal(computePlayerRoundPoints(match, 'p1'), 100, 'p1 voted the impostor');
  assert.equal(computePlayerRoundPoints(match, 'p2'), 100, 'impostor guessed correctly');
  assert.equal(computePlayerRoundPoints(match, 'p3'), 0, 'p3 voted the wrong player');

  const scored = applyRoundScores(match);
  assert.deepEqual(scored.scores, { p1: 100, p2: 100, p3: 0 });
});

test('scoring: impostor wrong guess gets 0', () => {
  const match = makeMatch({ votes: { p1: 'p2', p3: 'p2' }, guessedCorrectly: false });
  const scored = applyRoundScores(match);
  assert.deepEqual(scored.scores, { p1: 100, p2: 0, p3: 100 });
});

test('scoring: accumulates on top of previous rounds without mutating input', () => {
  const match = makeMatch({ votes: { p1: 'p2' }, guessedCorrectly: true });
  match.scores = { p1: 100, p2: 200, p3: 0 };
  const scored = applyRoundScores(match);
  assert.deepEqual(scored.scores, { p1: 200, p2: 300, p3: 0 });
  assert.deepEqual(match.scores, { p1: 100, p2: 200, p3: 0 }, 'input not mutated');
});

test('leaderboard: tied winners share rank and isFirstPlace', () => {
  const match = makeMatch();
  match.scores = { p1: 200, p2: 200, p3: 100 };
  const entries = buildResultsLeaderboardEntries(match);
  assert.equal(entries[0]!.rank, 1);
  assert.equal(entries[1]!.rank, 1, 'tie shares rank 1');
  assert.equal(entries[0]!.isFirstPlace, true);
  assert.equal(entries[1]!.isFirstPlace, true);
  assert.equal(entries[2]!.isFirstPlace, false);
});

// --- Role acknowledgement ---

test('role understood: one acknowledgement per participant; all connected completes phase gate', () => {
  const shell = makeShell();
  let match = makeMatch({ gamePhase: 'description' });

  assert.equal(haveAllConnectedParticipantsAcknowledgedRole(shell, match), false);

  match = applyRoleUnderstood(match, 'p1');
  assert.equal(haveAllConnectedParticipantsAcknowledgedRole(shell, match), false);
  assert.deepEqual(match.round.roleUnderstoodPlayerIds, ['p1']);

  match = applyRoleUnderstood(match, 'p1');
  assert.deepEqual(match.round.roleUnderstoodPlayerIds, ['p1'], 'duplicate ack ignored');

  match = applyRoleUnderstood(match, 'p2');
  match = applyRoleUnderstood(match, 'p3');
  assert.equal(haveAllConnectedParticipantsAcknowledgedRole(shell, match), true);
});

test('role understood view: aggregate progress only; reconnect restores self ack state', () => {
  const shell = makeShell();
  const match = applyRoleUnderstood(
    applyRoleUnderstood(makeMatch({ gamePhase: 'description' }), 'p1'),
    'p2',
  );

  const ackedView = buildBaraAlSalafaPlayerView(match, 'p1', shell);
  assert.equal(ackedView.hasAcknowledgedRole, true);
  assert.equal(ackedView.roleAcknowledgementCount, 2);
  assert.equal(ackedView.eligibleRoleAcknowledgementCount, 3);

  const pendingView = buildBaraAlSalafaPlayerView(match, 'p3', shell);
  assert.equal(pendingView.hasAcknowledgedRole, false);
});

test('role understood: disconnected participant does not block completion', () => {
  const shell = makeShell();
  shell.players[2]!.isConnected = false;
  let match = makeMatch({ gamePhase: 'description' });
  match = applyRoleUnderstood(match, 'p1');
  match = applyRoleUnderstood(match, 'p2');
  assert.equal(haveAllConnectedParticipantsAcknowledgedRole(shell, match), true);
});

// --- Directed questions ---

test('directed questions view: only current asker is active', () => {
  const shell = makeShell();
  const match = makeMatch({
    gamePhase: 'directed-questions',
    speakingOrder: ['p1', 'p2', 'p3'],
    directedQuestionPairs: [
      { askerPlayerId: 'p1', targetPlayerId: 'p2' },
      { askerPlayerId: 'p2', targetPlayerId: 'p3' },
      { askerPlayerId: 'p3', targetPlayerId: 'p1' },
    ],
    currentSpeakerIndex: 0,
    phaseRemainingSeconds: 0,
  });

  const askerView = buildBaraAlSalafaPlayerView(match, 'p1', shell);
  assert.equal(askerView.isDirectedQuestionActiveAsker, true);
  assert.equal(askerView.directedQuestionAskerPlayerId, 'p1');
  assert.equal(askerView.directedQuestionTargetPlayerId, 'p2');

  const waiterView = buildBaraAlSalafaPlayerView(match, 'p3', shell);
  assert.equal(waiterView.isDirectedQuestionActiveAsker, false);
  assert.equal(waiterView.directedQuestionAskerName, 'محمد');
  assert.equal(waiterView.directedQuestionTargetName, 'خالد');
  assert.equal(waiterView.instruction, 'محمد اسأل خالد');
});

test('directed questions view: asker-target order preserved for target and observer', () => {
  const shell = makeShell();
  const match = makeMatch({
    gamePhase: 'directed-questions',
    speakingOrder: ['p2', 'p3', 'p1'],
    directedQuestionPairs: [
      { askerPlayerId: 'p2', targetPlayerId: 'p3' },
      { askerPlayerId: 'p3', targetPlayerId: 'p1' },
      { askerPlayerId: 'p1', targetPlayerId: 'p2' },
    ],
    currentSpeakerIndex: 0,
    phaseRemainingSeconds: 0,
  });

  const targetView = buildBaraAlSalafaPlayerView(match, 'p3', shell);
  assert.equal(targetView.directedQuestionAskerPlayerId, 'p2');
  assert.equal(targetView.directedQuestionTargetPlayerId, 'p3');
  assert.equal(targetView.directedQuestionAskerName, 'خالد');
  assert.equal(targetView.directedQuestionTargetName, 'علي');

  const observerView = buildBaraAlSalafaPlayerView(match, 'p1', shell);
  assert.equal(observerView.directedQuestionAskerName, 'خالد');
  assert.equal(observerView.directedQuestionTargetName, 'علي');
});

test('free questions conversation view: authoritative asker and pending target for all viewers', () => {
  const shell = makeShell();
  const match = makeMatch({
    gamePhase: 'free-questions',
    activeFreeQuestionPlayerId: 'p2',
    pendingFreeQuestionTargetPlayerId: 'p1',
    completedFreeQuestionTurns: [],
  });

  const askerView = buildBaraAlSalafaPlayerView(match, 'p2', shell);
  assert.equal(askerView.isFreeQuestionActivePlayer, true);
  assert.equal(askerView.activeFreeQuestionPlayerId, 'p2');
  assert.equal(askerView.activeFreeQuestionTargetPlayerId, 'p1');
  assert.equal(askerView.activeFreeQuestionPlayerName, 'خالد');
  assert.equal(askerView.activeFreeQuestionTargetPlayerName, 'محمد');
  assert.equal(askerView.instruction, 'خالد يسأل محمد');
  assert.deepEqual(askerView.selectablePlayers, []);

  const targetView = buildBaraAlSalafaPlayerView(match, 'p1', shell);
  assert.equal(targetView.isFreeQuestionActivePlayer, false);
  assert.equal(targetView.instruction, 'خالد يسأل محمد');
  assert.equal(targetView.activeFreeQuestionTargetPlayerId, 'p1');

  const observerView = buildBaraAlSalafaPlayerView(match, 'p3', shell);
  assert.equal(observerView.instruction, 'خالد يسأل محمد');
});

// --- Voting completion ---

test('voting completion: all connected voters required; disconnected does not block', () => {
  const shell = makeShell();
  let match = makeMatch({ gamePhase: 'voting' });
  assert.equal(haveAllConnectedParticipantsVoted(shell, match), false);

  match = applyVote(match, 'p1', 'p2');
  assert.equal(haveAllConnectedParticipantsVoted(shell, match), false);

  shell.players[2]!.isConnected = false;
  match = applyVote(match, 'p2', 'p1');
  assert.equal(haveAllConnectedParticipantsVoted(shell, match), true, 'disconnected p3 excluded');
});

// --- Round results host continue ---

test('round-results: host can continue; non-host sees waiting message', () => {
  const shell = makeShell();
  const match = applyRoundScores(
    makeMatch({ gamePhase: 'round-results', votes: { p1: 'p2', p3: 'p1' }, guessedCorrectly: true }),
  );

  const hostView = buildBaraAlSalafaPlayerView(match, 'p1', shell);
  assert.equal(hostView.isHost, true);
  assert.equal(hostView.canContinueFromRoundResults, true);
  assert.equal(hostView.roundResultsContinueLabel, 'التالي الآن');

  const guestView = buildBaraAlSalafaPlayerView(match, 'p3', shell);
  assert.equal(guestView.canContinueFromRoundResults, false);
  assert.ok(guestView.roundResultsWaitingMessage?.includes('تلقائيا'));
});

test('round-results final round: host sees عرض النتائج الآن', () => {
  const shell = makeShell();
  const match = applyRoundScores(
    makeMatch({
      gamePhase: 'round-results',
      votes: { p1: 'p2' },
      guessedCorrectly: false,
    }),
  );
  match.currentRound = 3;

  const hostView = buildBaraAlSalafaPlayerView(match, 'p1', shell);
  assert.equal(hostView.roundResultsContinueLabel, 'عرض النتائج الآن');
  assert.equal(hostView.roundResultsWaitingMessage, 'سيتم عرض النتائج النهائية تلقائياً...');
});

// --- Voting ---

test('voting: applyVote records voter exactly once', () => {
  const match = makeMatch({ gamePhase: 'voting' });
  const once = applyVote(match, 'p1', 'p2');
  const twice = applyVote(once, 'p1', 'p2');
  assert.deepEqual(twice.round.submittedVoterIds, ['p1']);
  assert.equal(twice.round.votes.p1, 'p2');
});

test('voting view privacy: no other-player vote targets exposed; self state restored', () => {
  const shell = makeShell();
  const match = applyVote(makeMatch({ gamePhase: 'voting' }), 'p1', 'p2');

  const voterView = buildBaraAlSalafaPlayerView(match, 'p1', shell);
  assert.equal(voterView.hasVoted, true);
  assert.equal(voterView.confirmedVoteTargetPlayerId, 'p2', 'own vote restored');
  assert.deepEqual(voterView.votablePlayers, [], 'no re-vote after submitting');

  const otherView = buildBaraAlSalafaPlayerView(match, 'p3', shell);
  assert.equal(otherView.hasVoted, false);
  assert.equal(otherView.confirmedVoteTargetPlayerId, null, 'cannot see p1 vote target');
  assert.equal(otherView.submittedVotesCount, 1, 'aggregate count only');
  assert.ok(
    otherView.votablePlayers.every((p) => p.id !== 'p3'),
    'cannot vote for self',
  );
});

// --- Role privacy ---

test('role privacy: impostor never receives the word; players never see impostor id', () => {
  const shell = makeShell();
  const match = makeMatch();

  const impostorView = buildBaraAlSalafaPlayerView(match, 'p2', shell);
  assert.equal(impostorView.role, 'impostor');
  assert.equal(impostorView.displayText, 'أنت برا السالفة');
  assert.ok(!impostorView.displayText.includes(match.round.word), 'word hidden from impostor');

  const playerView = buildBaraAlSalafaPlayerView(match, 'p1', shell);
  assert.equal(playerView.role, 'player');
  assert.equal(playerView.displayText, match.round.word);
  assert.equal(playerView.revealedImpostorPlayerId, null, 'impostor hidden in description');
});

// --- Impostor guess privacy ---

test('impostor guess privacy: only impostor gets options; others see waiting state', () => {
  const shell = makeShell();
  const match = makeMatch({
    gamePhase: 'impostor-guess',
    impostorGuessOptions: ['مكة', 'جدة', 'الرياض', 'الدمام'],
  });

  const impostorView = buildBaraAlSalafaPlayerView(match, 'p2', shell);
  assert.equal(impostorView.isImpostorGuessActivePlayer, true);
  assert.deepEqual(impostorView.impostorGuessOptions, ['مكة', 'جدة', 'الرياض', 'الدمام']);
  assert.equal(impostorView.displayText, '', 'word not leaked via displayText');

  for (const playerId of ['p1', 'p3']) {
    const view = buildBaraAlSalafaPlayerView(match, playerId, shell);
    assert.equal(view.isImpostorGuessActivePlayer, false);
    assert.deepEqual(view.impostorGuessOptions, [], `options hidden from ${playerId}`);
  }
});

test('impostor guess: options hidden after submission', () => {
  const shell = makeShell();
  const match = makeMatch({
    gamePhase: 'impostor-guess',
    impostorGuessOptions: ['مكة', 'جدة'],
    selectedWord: 'جدة',
  });

  const impostorView = buildBaraAlSalafaPlayerView(match, 'p2', shell);
  assert.equal(impostorView.hasSubmittedImpostorGuess, true);
  assert.deepEqual(impostorView.impostorGuessOptions, [], 'one submission only');
});

// --- Reveal impostor ---

test('reveal-impostor: identity only; secret word hidden until guess resolves', () => {
  const shell = makeShell();
  const match = makeMatch({ gamePhase: 'reveal-impostor', votes: { p1: 'p2', p3: 'p2' } });

  for (const playerId of ['p1', 'p2', 'p3']) {
    const view = buildBaraAlSalafaPlayerView(match, playerId, shell);
    assert.equal(view.revealedImpostorPlayerId, 'p2');
    assert.equal(view.revealedImpostorName, 'خالد');
    assert.equal(view.revealedWord, null, `${playerId} must not see public word yet`);
    assert.ok(!view.displayText.includes('مكة'), `${playerId} displayText must not leak word`);
  }
});

test('privacy before guess: normals know word; impostor and reveal do not leak it', () => {
  const shell = makeShell();

  const description = makeMatch({ gamePhase: 'description' });
  assert.equal(buildBaraAlSalafaPlayerView(description, 'p1', shell).displayText, 'مكة');
  assert.equal(buildBaraAlSalafaPlayerView(description, 'p2', shell).displayText, 'أنت برا السالفة');
  assert.equal(buildBaraAlSalafaPlayerView(description, 'p1', shell).spectatorCivilianWord, null);
  assert.equal(buildBaraAlSalafaSpectatorView(description).revealedWord, null);
  assert.equal(buildBaraAlSalafaSpectatorView(description).displayText, '');
  assert.equal(buildBaraAlSalafaSpectatorView(description).spectatorCivilianWord, 'مكة');
  assert.equal(buildBaraAlSalafaSpectatorView(description).spectatorOutsiderConcept, 'أنت برا السالفة');

  const reveal = makeMatch({ gamePhase: 'reveal-impostor' });
  assert.equal(buildBaraAlSalafaPlayerView(reveal, 'p2', shell).revealedWord, null);
  assert.equal(buildBaraAlSalafaPlayerView(reveal, 'p1', shell).revealedWord, null);

  const guessing = makeMatch({
    gamePhase: 'impostor-guess',
    impostorGuessOptions: ['مكة', 'جدة', 'الرياض', 'الدمام', 'تبوك', 'أبها', 'خميس', 'حائل'],
  });
  const impostorGuessView = buildBaraAlSalafaPlayerView(guessing, 'p2', shell);
  assert.equal(impostorGuessView.revealedWord, null);
  assert.equal(impostorGuessView.displayText, '');
  assert.ok(!impostorGuessView.displayText.includes('مكة'));
  assert.equal(buildBaraAlSalafaPlayerView(guessing, 'p1', shell).displayText, 'مكة');
  assert.equal(buildBaraAlSalafaPlayerView(guessing, 'p1', shell).revealedWord, null);
});

test('after guess resolves: secret word revealed to everyone', () => {
  const shell = makeShell();
  const match = makeMatch({
    gamePhase: 'impostor-guess-result',
    guessedCorrectly: true,
  });
  for (const playerId of ['p1', 'p2', 'p3']) {
    const view = buildBaraAlSalafaPlayerView(match, playerId, shell);
    assert.equal(view.revealedWord, 'مكة');
    assert.equal(view.guessResultMessage, 'إجابة صحيحة!');
  }
});

test('round-results host continue: next vs final round copy', () => {
  const shell = makeShell();
  const midMatch = applyRoundScores(
    makeMatch({ gamePhase: 'round-results', votes: { p1: 'p2' }, guessedCorrectly: false }),
  );
  const midHost = buildBaraAlSalafaPlayerView(midMatch, 'p1', shell);
  assert.equal(midHost.roundResultsContinueLabel, 'التالي الآن');
  assert.equal(midHost.roundResultsWaitingMessage, 'الجولة التالية تبدأ تلقائياً...');

  const finalMatch = applyRoundScores(
    makeMatch({ gamePhase: 'round-results', votes: { p1: 'p2' }, guessedCorrectly: false }),
  );
  finalMatch.currentRound = 3;
  finalMatch.totalRounds = 3;
  const finalHost = buildBaraAlSalafaPlayerView(finalMatch, 'p1', shell);
  assert.equal(finalHost.roundResultsContinueLabel, 'عرض النتائج الآن');
  assert.equal(finalHost.roundResultsWaitingMessage, 'سيتم عرض النتائج النهائية تلقائياً...');
});

test('spectator view shows both concepts without a player role', () => {
  const match = makeMatch({ gamePhase: 'voting' });
  const view = buildBaraAlSalafaSpectatorView(match);
  assert.equal(view.isMatchSpectator, true);
  assert.equal(view.displayText, '');
  assert.equal(view.spectatorCivilianWord, 'مكة');
  assert.equal(view.spectatorOutsiderConcept, 'أنت برا السالفة');
  assert.equal(view.revealedImpostorPlayerId, null);
  assert.equal(view.revealedWord, null);
  assert.equal(view.hasVoted, false);
  assert.equal(view.isImpostorGuessActivePlayer, false);
  assert.equal(view.categoryName, 'أماكن');
});

test('free product: fixed 3 rounds and timer constants', () => {
  assert.equal(BARA_AL_SALAFA_DEFAULT_ROUNDS, 3);
  assert.equal(resolveTotalRounds(), 3);
  assert.equal(BARA_AL_SALAFA_ROLE_REVEAL_DURATION_SECONDS, 20);
  assert.equal(BARA_AL_SALAFA_QUESTION_TURN_DURATION_SECONDS, 60);
  assert.equal(BARA_AL_SALAFA_VOTING_DURATION_SECONDS, 60);
  assert.equal(BARA_AL_SALAFA_IMPOSTOR_GUESS_DURATION_SECONDS, 60);
  assert.equal(BARA_AL_SALAFA_ROUND_RESULTS_DURATION_SECONDS, 10);
  assert.equal(BARA_AL_SALAFA_MATCH_RESULTS_DURATION_SECONDS, 30);
  assert.equal(MAX_ROOM_PLAYERS, 8);
});

test('match-completed view exposes host return CTA and auto-lobby message', () => {
  const shell = makeShell();
  const match = makeMatch({ gamePhase: 'match-completed' });
  match.matchStatus = 'completed';

  const hostView = buildBaraAlSalafaPlayerView(match, 'p1', shell);
  assert.equal(hostView.canContinueFromRoundResults, true);
  assert.equal(hostView.roundResultsContinueLabel, 'العودة إلى اللوبي');
  assert.ok(hostView.roundResultsWaitingMessage?.includes('اللوبي'));

  const guestView = buildBaraAlSalafaPlayerView(match, 'p3', shell);
  assert.equal(guestView.canContinueFromRoundResults, false);
  assert.ok(guestView.roundResultsWaitingMessage?.includes('اللوبي'));
});

test('word picker avoids used words when alternatives exist', () => {
  const contentDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../content/bara-al-salafa',
  );
  const words = JSON.parse(readFileSync(path.join(contentDir, 'words.json'), 'utf8')) as Array<{
    id: string;
    text: string;
    categoryId: string;
  }>;
  const categories = JSON.parse(
    readFileSync(path.join(contentDir, 'categories.json'), 'utf8'),
  ) as Array<{ id: string; name: string; enabled: boolean }>;
  const bundle = { words, categories, prompts: [], questions: [], images: [] };
  const first = pickRandomWordFromCategories(bundle, ['animals']);
  assert.ok(first);
  const second = pickRandomWordFromCategories(bundle, ['animals'], [first!.text]);
  assert.ok(second);
  assert.notEqual(second!.text, first!.text);

  const options = buildImpostorGuessOptions(bundle, first!.text, first!.categoryId, 8);
  assert.ok(options.includes(first!.text));
  assert.equal(new Set(options).size, options.length);
  assert.equal(options.length, 8, '12-word category yields 8 options');
  const categoryTexts = new Set(
    words.filter((word) => word.categoryId === first!.categoryId).map((word) => word.text),
  );
  for (const option of options) {
    assert.ok(categoryTexts.has(option), `option "${option}" must stay in ${first!.categoryId}`);
  }
});

test('impostor-guess-result wrong message synchronized', () => {
  const shell = makeShell();
  const wrong = makeMatch({
    gamePhase: 'impostor-guess-result',
    guessedCorrectly: false,
  });
  assert.equal(buildBaraAlSalafaPlayerView(wrong, 'p1', shell).guessResultMessage, 'إجابة خاطئة!');
  assert.equal(buildBaraAlSalafaPlayerView(wrong, 'p1', shell).revealedWord, 'مكة');
});
// --- Round results ---

test('round-results: reveals word, impostor, guess result, points, leaderboard', () => {
  const shell = makeShell();
  const match = applyRoundScores(
    makeMatch({ gamePhase: 'round-results', votes: { p1: 'p2', p3: 'p1' }, guessedCorrectly: true }),
  );

  const view = buildBaraAlSalafaPlayerView(match, 'p3', shell);
  assert.equal(view.revealedWord, 'مكة');
  assert.equal(view.revealedImpostorPlayerId, 'p2');
  assert.equal(view.impostorGuessedCorrectly, true);

  const byId = Object.fromEntries(view.roundResults.map((entry) => [entry.playerId, entry]));
  assert.equal(byId.p1!.roundPoints, 100);
  assert.equal(byId.p2!.roundPoints, 100);
  assert.equal(byId.p3!.roundPoints, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
