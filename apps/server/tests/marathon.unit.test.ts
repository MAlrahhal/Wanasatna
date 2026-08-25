import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MARATHON_SUPPORTED_GAME_IDS,
  MARATHON_TRANSITION_SECONDS,
  accumulateMarathonPoints,
  normalizeMarathonScores,
} from '@wanasatna/shared';
import { validateMarathonPlan } from '../src/modules/marathon/marathon.validation.js';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
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

function item(gameId: string, settings: Record<string, number> = {}) {
  return {
    gameId,
    configuration: {
      categoryId: 'all',
      settings,
      ...(gameId === 'timing-challenge'
        ? { timingChallenge: { mode: 'guess-time', minSeconds: 3, maxSeconds: 15 } }
        : {}),
      ...(gameId === 'draw-guess' ? { drawGuess: { drawerMode: 'random' } } : {}),
    },
  };
}

test('supports exactly seven games and excludes Guessing Challenge', () => {
  assert.equal(MARATHON_SUPPORTED_GAME_IDS.length, 7);
  assert.equal(MARATHON_SUPPORTED_GAME_IDS.includes('guessing-challenge' as never), false);
});

test('accepts two games and preserves order/settings', () => {
  const raw = [item('fast-answer', { rounds: 7 }), item('judge', { answerSeconds: 60 })];
  const result = validateMarathonPlan(raw);
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(
      result.plan.map((entry) => entry.gameId),
      ['fast-answer', 'judge'],
    );
    assert.equal(result.plan[0]!.configuration.settings.rounds, 7);
    assert.equal(result.plan[1]!.configuration.settings.answerSeconds, 60);
  }
});

test('accepts all seven games', () => {
  assert.equal(
    validateMarathonPlan(MARATHON_SUPPORTED_GAME_IDS.map((id) => item(id))).success,
    true,
  );
});

test('rejects one game, duplicates, and Guessing Challenge', () => {
  assert.equal(validateMarathonPlan([item('judge')]).success, false);
  assert.equal(validateMarathonPlan([item('judge'), item('judge')]).success, false);
  assert.equal(validateMarathonPlan([item('judge'), item('guessing-challenge')]).success, false);
});

test('leader gets 100 and proportional/tied scores normalize consistently', () => {
  const scores = normalizeMarathonScores([
    { playerId: 'a', score: 200 },
    { playerId: 'b', score: 100 },
    { playerId: 'c', score: 200 },
  ]);
  assert.deepEqual(
    scores.map((entry) => entry.marathonPoints),
    [100, 50, 100],
  );
});

test('all-zero game awards zero', () => {
  assert.deepEqual(
    normalizeMarathonScores([
      { playerId: 'a', score: 0 },
      { playerId: 'b', score: 0 },
    ]).map((entry) => entry.marathonPoints),
    [0, 0],
  );
});

test('cumulative scoring sums multiple games', () => {
  const first = accumulateMarathonPoints({}, [
    { playerId: 'a', marathonPoints: 100 },
    { playerId: 'b', marathonPoints: 50 },
  ]);
  const second = accumulateMarathonPoints(first, [
    { playerId: 'a', marathonPoints: 25 },
    { playerId: 'b', marathonPoints: 100 },
  ]);
  assert.deepEqual(second, { a: 125, b: 150 });
});

test('transition is ten seconds and authoritative path has stale guards', () => {
  assert.equal(MARATHON_TRANSITION_SECONDS, 10);
  const source = readFileSync(
    new URL('../src/modules/marathon/marathon.runtime.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /state\.marathonId !== guard\.marathonId/);
  assert.match(source, /state\.currentGameIndex !== guard\.currentGameIndex/);
  assert.match(source, /state\.activeShellId !== guard\.activeShellId/);
  assert.match(source, /startGameShellFromLobby/);
});

test('persisted match is awaited before Marathon leg teardown/advance', () => {
  const source = readFileSync(
    new URL('../src/modules/game/runtime/persist-completed-match.ts', import.meta.url),
    'utf8',
  );
  const completeAt = source.indexOf('await completePersistedMatch');
  const teardownAt = source.indexOf('teardown();', completeAt);
  const transitionAt = source.indexOf('activateMarathonTransition', teardownAt);
  assert.ok(completeAt >= 0 && teardownAt > completeAt && transitionAt > teardownAt);
});

test('midway joins stay spectators until final Marathon cleanup', () => {
  const joinSource = readFileSync(
    new URL('../src/modules/room/services/join-room.service.ts', import.meta.url),
    'utf8',
  );
  const cleanupSource = readFileSync(
    new URL('../src/modules/marathon/marathon.runtime.ts', import.meta.url),
    'utf8',
  );
  assert.match(joinSource, /isMarathonParticipationLocked\(roomId\)/);
  assert.match(cleanupSource, /await clearRoomSpectatorFlags\(roomId\)/);
  assert.ok(
    cleanupSource.indexOf('await clearRoomSpectatorFlags(roomId)') <
      cleanupSource.indexOf('deleteMarathonState(roomId)', cleanupSource.indexOf('returnMarathonToLobby')),
  );
});

test('leave/kick and room deletion update or clear Marathon lifecycle state', () => {
  const hooks = readFileSync(
    new URL('../src/modules/game/runtime/pregame-teams-room-hooks.ts', import.meta.url),
    'utf8',
  );
  assert.match(hooks, /markMarathonPlayerDeparted\(roomId, playerId\)/);
  assert.match(hooks, /clearMarathonState\(roomId\)/);
});

test('insufficient-player abort skips the current leg instead of ending the Marathon', () => {
  const abortSource = readFileSync(
    new URL('../src/modules/game/runtime/abort-active-match.ts', import.meta.url),
    'utf8',
  );
  assert.match(abortSource, /recordAbortedMarathonLeg/);
  assert.match(abortSource, /if \(marathonTransition\) \{\s*return true;/);
});

test('standalone Guessing Challenge completion remains outside Marathon persistence path', () => {
  const source = readFileSync(
    new URL(
      '../src/modules/game/plugins/guessing-challenge/match-lifecycle.ts',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(source, /persistCompletedMatchThen\(roomId, \(\) =>/);
  assert.doesNotMatch(source, /\}, io\);/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
