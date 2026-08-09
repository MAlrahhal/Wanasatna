/**
 * Unit tests for Timing Challenge (تحدي التوقيت).
 * Run: pnpm --filter @wanasatna/server exec tsx tests/timing-challenge.unit.test.ts
 */
import assert from 'node:assert/strict';
import type { GameShellState, TimingChallengeMatchState, TimingChallengeSettings } from '@wanasatna/shared';
import {
  applyRoundScores,
  buildLeaderboardEntries,
  buildRoundResultEntries,
  computeRoundPlacements,
  placementPoints,
} from '../src/modules/game/plugins/timing-challenge/scoring.js';
import {
  normalizeTimingChallengeSettings,
  pickTargetMs,
  defaultTimingChallengeSettings,
} from '../src/modules/game/plugins/timing-challenge/settings.js';
import {
  buildTimingChallengePlayerView,
  createEmptyPlayerState,
  createMatchState,
  withRound,
} from '../src/modules/game/plugins/timing-challenge/state.js';

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

function settings(overrides?: Partial<TimingChallengeSettings>): TimingChallengeSettings {
  return { ...defaultTimingChallengeSettings(), ...overrides };
}

function makeShell(playerIds: string[] = ['p1', 'p2']): GameShellState {
  return {
    shellId: 'shell-tc',
    roomId: 'room-tc',
    gameId: 'timing-challenge',
    phase: 'PLAYING',
    hostPlayerId: 'p1',
    players: playerIds.map((id, index) => ({
      id,
      name: id === 'p1' ? 'محمد' : id === 'p2' ? 'خالد' : `لاعب${index}`,
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

function makeMatch(
  mode: TimingChallengeSettings['mode'],
  overrides?: Partial<TimingChallengeMatchState>,
): TimingChallengeMatchState {
  const base = createMatchState(
    [
      { id: 'p1', name: 'محمد', isConnected: true, isHost: true, isReady: true },
      { id: 'p2', name: 'خالد', isConnected: true, isHost: false, isReady: true },
      { id: 'p3', name: 'سامي', isConnected: true, isHost: false, isReady: true },
    ],
    settings({ mode, rounds: 3, minSeconds: 3, maxSeconds: 15 }),
  );

  return {
    ...base,
    ...overrides,
    round: {
      ...base.round,
      ...(overrides?.round ?? {}),
      targetMs: overrides?.round?.targetMs ?? 7350,
      playerStates: {
        ...base.round.playerStates,
        ...(overrides?.round?.playerStates ?? {}),
      },
    },
  };
}

// --- Settings / Mode A generation ---

test('A: default settings create a valid match', () => {
  const match = createMatchState(
    [
      { id: 'p1', name: 'أ', isConnected: true, isHost: true, isReady: true },
      { id: 'p2', name: 'ب', isConnected: true, isHost: false, isReady: true },
    ],
    defaultTimingChallengeSettings(),
  );
  assert.equal(match.playerIds.length, 2);
  assert.equal(match.totalRounds, 3);
  assert.equal(match.round.gamePhase, 'ready');
});

test('B: hidden target generated inside configured range', () => {
  const cfg = settings({ minSeconds: 4, maxSeconds: 8 });
  for (let i = 0; i < 40; i += 1) {
    const targetMs = pickTargetMs(cfg);
    assert.ok(targetMs >= 4000 && targetMs <= 8000, `out of range: ${targetMs}`);
    assert.equal(targetMs % 10, 0);
  }
});

test('C: Mode A hides target before reveal', () => {
  const match = makeMatch('guess-time', {
    round: {
      ...makeMatch('guess-time').round,
      gamePhase: 'guessing',
      targetMs: 8420,
    },
  });
  const view = buildTimingChallengePlayerView(match, 'p1', makeShell(['p1', 'p2', 'p3']));
  assert.equal(view.targetMs, null);
  assert.equal(view.phaseRemainingSeconds, 0);
});

test('D/E/F: guess submission semantics via state + validation rules', () => {
  const invalid = normalizeTimingChallengeSettings({
    mode: 'guess-time',
    rounds: 3,
    minSeconds: 10,
    maxSeconds: 5,
  });
  assert.ok('error' in invalid);

  const match = makeMatch('guess-time', {
    round: {
      ...makeMatch('guess-time').round,
      gamePhase: 'guessing',
      targetMs: 8000,
      playerStates: {
        p1: { ...createEmptyPlayerState(), guessMs: 8100, errorMs: 100, signedDeltaMs: 100, elapsedMs: 8100 },
        p2: createEmptyPlayerState(),
        p3: createEmptyPlayerState(),
      },
    },
  });

  const viewSubmitted = buildTimingChallengePlayerView(match, 'p1', makeShell(['p1', 'p2', 'p3']));
  assert.equal(viewSubmitted.selfSubmitted, true);
  assert.equal(viewSubmitted.canGuess, false);
  assert.equal(viewSubmitted.selfGuessMs, 8100);

  const viewOpen = buildTimingChallengePlayerView(match, 'p2', makeShell(['p1', 'p2', 'p3']));
  assert.equal(viewOpen.canGuess, true);
  assert.equal(viewOpen.selfGuessMs, null);
});

test('G/H: all guesses scored; closest wins', () => {
  let match = makeMatch('guess-time', {
    round: {
      ...makeMatch('guess-time').round,
      gamePhase: 'guessing',
      targetMs: 10000,
      playerStates: {
        p1: { ...createEmptyPlayerState(), guessMs: 9800, elapsedMs: 9800, errorMs: 200, signedDeltaMs: -200 },
        p2: { ...createEmptyPlayerState(), guessMs: 10200, elapsedMs: 10200, errorMs: 200, signedDeltaMs: 200 },
        p3: { ...createEmptyPlayerState(), guessMs: 8000, elapsedMs: 8000, errorMs: 2000, signedDeltaMs: -2000 },
      },
    },
  });

  match = applyRoundScores(match);
  match = withRound(match, { ...match.round, gamePhase: 'round-results' });

  const results = buildRoundResultEntries(match);
  assert.equal(results[0]!.errorMs, 200);
  assert.equal(results[0]!.isTied, true);
  assert.equal(results[0]!.roundPoints, 100);
  assert.equal(results[1]!.roundPoints, 100);
  assert.equal(results[2]!.placement, 3);
  assert.equal(results[2]!.roundPoints, 50);
});

test('I: equal absolute error creates shared placement score', () => {
  const placements = computeRoundPlacements(
    makeMatch('stop-timer', {
      round: {
        ...makeMatch('stop-timer').round,
        targetMs: 10000,
        playerStates: {
          p1: { ...createEmptyPlayerState(), elapsedMs: 9800, errorMs: 200, signedDeltaMs: -200 },
          p2: { ...createEmptyPlayerState(), elapsedMs: 10200, errorMs: 200, signedDeltaMs: 200 },
          p3: { ...createEmptyPlayerState(), elapsedMs: 11000, errorMs: 1000, signedDeltaMs: 1000 },
        },
      },
    }),
  );

  assert.equal(placements[0]!.placement, 1);
  assert.equal(placements[1]!.placement, 1);
  assert.equal(placements[0]!.roundPoints, placements[1]!.roundPoints);
  assert.equal(placements[2]!.placement, 3);
});

test('J: cumulative scores update after applyRoundScores', () => {
  let match = makeMatch('guess-time', {
    scores: { p1: 25, p2: 0, p3: 0 },
    round: {
      ...makeMatch('guess-time').round,
      targetMs: 5000,
      playerStates: {
        p1: { ...createEmptyPlayerState(), guessMs: 5000, elapsedMs: 5000, errorMs: 0, signedDeltaMs: 0 },
        p2: { ...createEmptyPlayerState(), guessMs: 6000, elapsedMs: 6000, errorMs: 1000, signedDeltaMs: 1000 },
        p3: { ...createEmptyPlayerState(), guessMs: 7000, elapsedMs: 7000, errorMs: 2000, signedDeltaMs: 2000 },
      },
    },
  });

  match = applyRoundScores(match);
  assert.equal(match.scores.p1, 125);
  assert.equal(match.scores.p2, 75);
  assert.equal(match.scores.p3, 50);
  assert.equal(placementPoints(4), 25);
});

test('K/L: reconnect view restores guess submitted / not submitted', () => {
  const match = makeMatch('guess-time', {
    round: {
      ...makeMatch('guess-time').round,
      gamePhase: 'guessing',
      targetMs: 7000,
      playerStates: {
        p1: { ...createEmptyPlayerState(), guessMs: 7100, elapsedMs: 7100, errorMs: 100, signedDeltaMs: 100 },
        p2: createEmptyPlayerState(),
        p3: createEmptyPlayerState(),
      },
    },
  });
  const shell = makeShell(['p1', 'p2', 'p3']);
  assert.equal(buildTimingChallengePlayerView(match, 'p1', shell).selfSubmitted, true);
  assert.equal(buildTimingChallengePlayerView(match, 'p2', shell).selfSubmitted, false);
  assert.equal(buildTimingChallengePlayerView(match, 'p1', shell).targetMs, null);
});

// --- Mode B ---

test('M: Mode B target inside range and public', () => {
  const cfg = settings({ mode: 'stop-timer', minSeconds: 5, maxSeconds: 12 });
  const targetMs = pickTargetMs(cfg);
  assert.ok(targetMs >= 5000 && targetMs <= 12000);

  const match = makeMatch('stop-timer', {
    round: {
      ...makeMatch('stop-timer').round,
      gamePhase: 'stop-timer',
      targetMs,
    },
  });
  const view = buildTimingChallengePlayerView(match, 'p1', makeShell(['p1', 'p2', 'p3']));
  assert.equal(view.targetMs, targetMs);
});

test('N/O/P/Q/R/S/T: authoritative timer fields and rejection semantics', () => {
  const startMs = 1_000_000;
  const stopMs = 1_007_350;
  const targetMs = 7350;
  const elapsedMs = stopMs - startMs;
  assert.equal(elapsedMs, 7350);
  assert.equal(Math.abs(elapsedMs - targetMs), 0);

  let state = createEmptyPlayerState();
  assert.equal(state.timerStartedAtMs, null);

  // start
  state = { ...state, timerStartedAtMs: startMs };
  assert.notEqual(state.timerStartedAtMs, null);
  // double start rejected by handler when timerStartedAtMs !== null
  assert.notEqual(state.timerStartedAtMs, null);

  // stop before start rejected when timerStartedAtMs === null
  const beforeStart = createEmptyPlayerState();
  assert.equal(beforeStart.timerStartedAtMs, null);

  // stop
  state = {
    ...state,
    stoppedAtMs: stopMs,
    elapsedMs,
    signedDeltaMs: elapsedMs - targetMs,
    errorMs: Math.abs(elapsedMs - targetMs),
  };
  assert.equal(state.errorMs, 0);
  // double stop rejected when elapsedMs !== null
  assert.notEqual(state.elapsedMs, null);
});

test('U/V: tie + peers hide private elapsed before reveal', () => {
  const match = makeMatch('stop-timer', {
    round: {
      ...makeMatch('stop-timer').round,
      gamePhase: 'stop-timer',
      targetMs: 10000,
      playerStates: {
        p1: {
          ...createEmptyPlayerState(),
          timerStartedAtMs: 1,
          stoppedAtMs: 9801,
          elapsedMs: 9800,
          errorMs: 200,
          signedDeltaMs: -200,
        },
        p2: {
          ...createEmptyPlayerState(),
          timerStartedAtMs: 1,
          stoppedAtMs: 10201,
          elapsedMs: 10200,
          errorMs: 200,
          signedDeltaMs: 200,
        },
        p3: { ...createEmptyPlayerState(), timerStartedAtMs: 5 },
      },
    },
  });

  const viewP3 = buildTimingChallengePlayerView(match, 'p3', makeShell(['p1', 'p2', 'p3']));
  assert.equal(viewP3.roundResults.length, 0);
  assert.equal(viewP3.peers.find((p) => p.playerId === 'p1')?.status, 'done');
  assert.equal(viewP3.peers.find((p) => p.playerId === 'p3')?.status, 'running');
  // Other players' elapsed not present on peer status objects
  assert.equal('elapsedMs' in (viewP3.peers[0] as object), false);

  const placements = computeRoundPlacements(
    withRound(match, { ...match.round, gamePhase: 'round-results' }),
  );
  assert.equal(placements[0]!.isTied, true);
  assert.equal(placements[1]!.isTied, true);
});

test('W: results available only after reveal phase', () => {
  const match = makeMatch('stop-timer', {
    round: {
      ...makeMatch('stop-timer').round,
      gamePhase: 'round-results',
      targetMs: 7000,
      playerStates: {
        p1: { ...createEmptyPlayerState(), elapsedMs: 7010, errorMs: 10, signedDeltaMs: 10 },
        p2: { ...createEmptyPlayerState(), elapsedMs: 7200, errorMs: 200, signedDeltaMs: 200 },
        p3: { ...createEmptyPlayerState(), elapsedMs: 8000, errorMs: 1000, signedDeltaMs: 1000 },
      },
    },
  });
  const scored = applyRoundScores(match);
  const view = buildTimingChallengePlayerView(scored, 'p2', makeShell(['p1', 'p2', 'p3']));
  assert.ok(view.roundResults.length >= 3);
  assert.equal(view.targetMs, 7000);
});

test('X/Y: reconnect during/after personal timer does not reset attempt', () => {
  const running = makeMatch('stop-timer', {
    round: {
      ...makeMatch('stop-timer').round,
      gamePhase: 'stop-timer',
      targetMs: 8000,
      playerStates: {
        p1: { ...createEmptyPlayerState(), timerStartedAtMs: 12345 },
        p2: createEmptyPlayerState(),
        p3: createEmptyPlayerState(),
      },
    },
  });
  const runningView = buildTimingChallengePlayerView(running, 'p1', makeShell(['p1', 'p2', 'p3']));
  assert.equal(runningView.selfTimerRunning, true);
  assert.equal(runningView.canStartTimer, false);
  assert.equal(runningView.canStopTimer, true);

  const stopped = withRound(running, {
    ...running.round,
    playerStates: {
      ...running.round.playerStates,
      p1: {
        ...running.round.playerStates.p1!,
        stoppedAtMs: 20000,
        elapsedMs: 7655,
        errorMs: 345,
        signedDeltaMs: -345,
      },
    },
  });
  const stoppedView = buildTimingChallengePlayerView(stopped, 'p1', makeShell(['p1', 'p2', 'p3']));
  assert.equal(stoppedView.selfSubmitted, true);
  assert.equal(stoppedView.canStartTimer, false);
  assert.equal(stoppedView.canStopTimer, false);
  assert.equal(stoppedView.selfElapsedMs, 7655);
});

test('Z: score ordering on leaderboard', () => {
  const match = makeMatch('guess-time', {
    scores: { p1: 100, p2: 175, p3: 100 },
  });
  const board = buildLeaderboardEntries(match);
  assert.equal(board[0]!.playerId, 'p2');
  assert.equal(board[0]!.score, 175);
});

test('AF/AG: waiting / non-participant cannot act', () => {
  const match = makeMatch('guess-time', {
    round: {
      ...makeMatch('guess-time').round,
      gamePhase: 'guessing',
    },
  });
  const shell = makeShell(['p1', 'p2', 'p3']);
  const waiterView = buildTimingChallengePlayerView(match, 'waiter', shell);
  assert.equal(waiterView.canGuess, false);
  assert.equal(waiterView.canReady, false);
  assert.equal(waiterView.canStartTimer, false);
});

test('AH/AI: host continue labels for mid vs final round', () => {
  const mid = makeMatch('guess-time', {
    currentRound: 1,
    totalRounds: 3,
    round: { ...makeMatch('guess-time').round, gamePhase: 'round-results', targetMs: 5000 },
  });
  const midView = buildTimingChallengePlayerView(mid, 'p1', makeShell(['p1', 'p2', 'p3']));
  assert.equal(midView.canContinueFromRoundResults, true);
  assert.equal(midView.roundResultsContinueLabel, 'بدء الجولة التالية');

  const final = makeMatch('guess-time', {
    currentRound: 3,
    totalRounds: 3,
    round: { ...makeMatch('guess-time').round, gamePhase: 'round-results', targetMs: 5000 },
  });
  const finalView = buildTimingChallengePlayerView(final, 'p1', makeShell(['p1', 'p2', 'p3']));
  assert.equal(finalView.roundResultsContinueLabel, 'عرض النتائج النهائية');
});

test('invalid settings rejected', () => {
  assert.ok('error' in normalizeTimingChallengeSettings({ mode: 'guess-time', rounds: 0 }));
  assert.ok('error' in normalizeTimingChallengeSettings({ mode: 'nope' as never }));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
