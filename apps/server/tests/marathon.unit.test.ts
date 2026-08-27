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
      categoryId: gameId === 'timing-challenge' ? null : 'random',
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

test('each leg keeps an independent validated settings snapshot through reorder', () => {
  const original = [
    item('fast-answer', { rounds: 7, answerSeconds: 20 }),
    item('judge', { answerSeconds: 60, judgeSeconds: 30 }),
  ];
  const reordered = validateMarathonPlan([original[1], original[0]]);
  assert.equal(reordered.success, true);
  if (reordered.success) {
    assert.deepEqual(reordered.plan[0]!.configuration.settings, {
      answerSeconds: 60,
      judgeSeconds: 30,
    });
    assert.deepEqual(reordered.plan[1]!.configuration.settings, {
      answerSeconds: 20,
      rounds: 7,
    });
    assert.notEqual(
      reordered.plan[0]!.configuration.settings,
      reordered.plan[1]!.configuration.settings,
    );
  }
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

test('setup mutations and End Marathon are current-host authorized server-side', () => {
  const runtime = readFileSync(
    new URL('../src/modules/marathon/marathon.runtime.ts', import.meta.url),
    'utf8',
  );
  const socket = readFileSync(
    new URL('../src/modules/marathon/marathon.socket.ts', import.meta.url),
    'utf8',
  );
  assert.match(runtime, /currentHost\(roomId\)\) !== playerId/);
  assert.match(runtime, /export async function endMarathonByHost/);
  assert.match(runtime, /finishReason: 'host-ended'/);
  assert.match(socket, /MARATHON_END_EVENT/);
});

test('client state redacts every leg configuration while preserving game order', () => {
  const runtime = readFileSync(
    new URL('../src/modules/marathon/marathon.runtime.ts', import.meta.url),
    'utf8',
  );
  const socket = readFileSync(
    new URL('../src/modules/marathon/marathon.socket.ts', import.meta.url),
    'utf8',
  );
  assert.match(runtime, /configuration: \{ categoryId: null, settings: \{\} \}/);
  assert.match(socket, /toMarathonClientState\(state\)/);
});

test('intermediate transitions stay on Marathon and final cleanup alone returns to Lobby', () => {
  const runtime = readFileSync(
    new URL('../src/modules/marathon/marathon.runtime.ts', import.meta.url),
    'utf8',
  );
  const transitionStart = runtime.indexOf('export function activateMarathonTransition');
  const transitionEnd = runtime.indexOf('function scheduleAdvance', transitionStart);
  const transitionSource = runtime.slice(transitionStart, transitionEnd);
  assert.match(transitionSource, /path: '\/marathon'/);
  assert.doesNotMatch(
    transitionSource,
    /navigateRoomToLobby|clearRoomSpectatorFlags|deleteMarathonState/,
  );
  assert.match(runtime, /returnMarathonToLobby/);
  assert.match(runtime, /endingRooms\.has\(state\.roomId\)/);
  const lifecycle = readFileSync(
    new URL('../src/modules/game/game.lifecycle.ts', import.meta.url),
    'utf8',
  );
  assert.match(lifecycle, /marathonStatus === 'TRANSITION' \|\| marathonStatus === 'FINISHED'/);
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
  assert.match(source, /pendingMarathonCompletions\.has\(completionKey\)/);
  assert.match(source, /pendingMarathonCompletions\.add\(completionKey\)/);
});

test('concurrent transition advances are serialized per room', () => {
  const source = readFileSync(
    new URL('../src/modules/marathon/marathon.runtime.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /advancingRooms\.has\(state\.roomId\)/);
  assert.match(source, /advancingRooms\.add\(state\.roomId\)/);
  assert.match(source, /finally \{\s*advancingRooms\.delete\(state\.roomId\)/);
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
      cleanupSource.indexOf(
        'deleteMarathonState(roomId)',
        cleanupSource.indexOf('returnMarathonToLobby'),
      ),
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
    new URL('../src/modules/game/plugins/guessing-challenge/match-lifecycle.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /persistCompletedMatchThen\(roomId, \(\) =>/);
  assert.doesNotMatch(source, /\}, io\);/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
