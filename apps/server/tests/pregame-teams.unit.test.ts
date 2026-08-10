/**
 * Pregame Team System unit tests (pure + in-memory store).
 */
import assert from 'node:assert/strict';
import {
  getGameTeamCapability,
  GUESSING_CHALLENGE_GAME_ID,
  GUESSING_CHALLENGE_TEAM_CAPABILITY,
} from '@wanasatna/shared';
import {
  assignPlayerToTeam,
  clearTeamsForRoom,
  configurePregameTeams,
  randomizePregameTeams,
  removePlayerFromPregameTeams,
  syncPregameTeamsWithRoster,
  validatePregameTeamsForStart,
} from '../src/modules/game/runtime/pregame-teams.service.js';
import { clearPregameTeams, getPregameTeams } from '../src/modules/game/runtime/pregame-teams-store.js';
import { assignTeams } from '../src/modules/game/plugins/guessing-challenge/state.js';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

const roomId = 'room-team-unit';

run('A team-capable game exposes Team capability', () => {
  assert.deepEqual(getGameTeamCapability(GUESSING_CHALLENGE_GAME_ID), GUESSING_CHALLENGE_TEAM_CAPABILITY);
});

run('B non-team game does not', () => {
  assert.equal(getGameTeamCapability('bara-al-salafa'), null);
  assert.equal(getGameTeamCapability('timing-challenge'), null);
});

run('C valid default 1v1 assignment', () => {
  clearPregameTeams(roomId);
  const ids = ['a', 'b'];
  const result = configurePregameTeams({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '1v1',
    eligiblePlayerIds: ids,
    preserveManual: false,
  });
  assert.ok(result.success);
  assert.equal(result.data.assignments.length, 2);
  assert.equal(result.data.assignments.find((e) => e.playerId === 'a')?.teamId, 'blue');
  assert.equal(result.data.assignments.find((e) => e.playerId === 'b')?.teamId, 'red');
});

run('D valid default 2v2 assignment', () => {
  clearPregameTeams(roomId);
  const ids = ['a', 'b', 'c', 'd'];
  const result = configurePregameTeams({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '2v2',
    eligiblePlayerIds: ids,
    preserveManual: false,
  });
  assert.ok(result.success);
  assert.deepEqual(
    result.data.assignments.filter((e) => e.teamId === 'blue').map((e) => e.playerId),
    ['a', 'c'],
  );
  assert.deepEqual(
    result.data.assignments.filter((e) => e.teamId === 'red').map((e) => e.playerId),
    ['b', 'd'],
  );
});

run('E host moves player (cross-team swap when dest full)', () => {
  clearPregameTeams(roomId);
  configurePregameTeams({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '2v2',
    eligiblePlayerIds: ['a', 'b', 'c', 'd'],
    preserveManual: false,
  });
  // Defaults: blue=[a,c] red=[b,d]. Move c→red swaps with last red seat (d).
  const swapped = assignPlayerToTeam({
    roomId,
    playerId: 'c',
    teamId: 'red',
    eligiblePlayerIds: ['a', 'b', 'c', 'd'],
  });
  assert.ok(swapped.success);
  assert.equal(swapped.data.assignments.find((e) => e.playerId === 'c')?.teamId, 'red');
  assert.equal(swapped.data.assignments.find((e) => e.playerId === 'd')?.teamId, 'blue');

  // Free-capacity path still works
  removePlayerFromPregameTeams(roomId, 'd', ['a', 'b', 'c']);
  const moved = assignPlayerToTeam({
    roomId,
    playerId: 'b',
    teamId: 'blue',
    eligiblePlayerIds: ['a', 'b', 'c'],
  });
  assert.ok(moved.success);
  assert.equal(moved.data.assignments.find((e) => e.playerId === 'b')?.teamId, 'blue');
});

run('G capacity enforced (unassigned → full team)', () => {
  clearPregameTeams(roomId);
  configurePregameTeams({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '1v1',
    eligiblePlayerIds: ['a', 'b', 'c'],
    preserveManual: false,
  });
  // Defaults fill a→blue, b→red; c remains unassigned. Full blue rejects.
  const result = assignPlayerToTeam({
    roomId,
    playerId: 'c',
    teamId: 'blue',
    eligiblePlayerIds: ['a', 'b', 'c'],
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.code, 'TEAM_FULL');
  }
});

run('H duplicate assignment impossible', () => {
  clearPregameTeams(roomId);
  configurePregameTeams({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '2v2',
    eligiblePlayerIds: ['a', 'b', 'c', 'd'],
    preserveManual: false,
  });
  removePlayerFromPregameTeams(roomId, 'd', ['a', 'b', 'c']);
  const moved = assignPlayerToTeam({
    roomId,
    playerId: 'a',
    teamId: 'red',
    eligiblePlayerIds: ['a', 'b', 'c'],
  });
  assert.ok(moved.success);
  const state = getPregameTeams(roomId)!;
  assert.ok(!state.blue.includes('a'));
  assert.equal(state.red.filter((id) => id === 'a').length, 1);
});

run('I balanced randomization', () => {
  clearPregameTeams(roomId);
  configurePregameTeams({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '2v2',
    eligiblePlayerIds: ['a', 'b', 'c', 'd'],
    preserveManual: false,
  });
  const result = randomizePregameTeams({
    roomId,
    eligiblePlayerIds: ['a', 'b', 'c', 'd'],
  });
  assert.ok(result.success);
  assert.equal(result.data.assignments.filter((e) => e.teamId === 'blue').length, 2);
  assert.equal(result.data.assignments.filter((e) => e.teamId === 'red').length, 2);
  assert.equal(new Set(result.data.assignments.map((e) => e.playerId)).size, 4);
});

run('J leave removes assignment', () => {
  clearPregameTeams(roomId);
  configurePregameTeams({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '2v2',
    eligiblePlayerIds: ['a', 'b', 'c', 'd'],
    preserveManual: false,
  });
  const snap = removePlayerFromPregameTeams(roomId, 'c', ['a', 'b', 'd']);
  assert.ok(snap);
  assert.ok(!snap.assignments.some((e) => e.playerId === 'c'));
});

run('O 2v2 → 1v1 reconciliation', () => {
  clearPregameTeams(roomId);
  configurePregameTeams({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '2v2',
    eligiblePlayerIds: ['a', 'b', 'c', 'd'],
    preserveManual: false,
  });
  assignPlayerToTeam({
    roomId,
    playerId: 'a',
    teamId: 'blue',
    eligiblePlayerIds: ['a', 'b', 'c', 'd'],
  });
  // mark manual by moving after freeing
  removePlayerFromPregameTeams(roomId, 'c', ['a', 'b', 'd']);
  assignPlayerToTeam({
    roomId,
    playerId: 'd',
    teamId: 'blue',
    eligiblePlayerIds: ['a', 'b', 'd'],
  });

  const result = configurePregameTeams({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '1v1',
    eligiblePlayerIds: ['a', 'b'],
    preserveManual: true,
  });
  assert.ok(result.success);
  assert.equal(result.data.capacityPerTeam, 1);
  assert.ok(result.data.assignments.filter((e) => e.teamId === 'blue').length <= 1);
  assert.ok(result.data.assignments.filter((e) => e.teamId === 'red').length <= 1);
});

run('P 1v1 → 2v2 reconciliation defaults when not manual', () => {
  clearPregameTeams(roomId);
  configurePregameTeams({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '1v1',
    eligiblePlayerIds: ['a', 'b'],
    preserveManual: false,
  });
  const result = configurePregameTeams({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '2v2',
    eligiblePlayerIds: ['a', 'b', 'c', 'd'],
    preserveManual: true,
  });
  assert.ok(result.success);
  assert.equal(result.data.capacityPerTeam, 2);
});

run('Q team game → non-team isolation', () => {
  clearPregameTeams(roomId);
  configurePregameTeams({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '1v1',
    eligiblePlayerIds: ['a', 'b'],
    preserveManual: false,
  });
  clearTeamsForRoom(roomId);
  assert.equal(getPregameTeams(roomId), null);
  const rejected = configurePregameTeams({
    roomId,
    gameId: 'bara-al-salafa',
    mode: '1v1',
    eligiblePlayerIds: ['a', 'b', 'c'],
    preserveManual: false,
  });
  assert.equal(rejected.success, false);
});

run('S unassigned after manual join sync', () => {
  clearPregameTeams(roomId);
  configurePregameTeams({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '2v2',
    eligiblePlayerIds: ['a', 'b', 'c', 'd'],
    preserveManual: false,
  });
  // Force manual flag via a real cross-team move (swap).
  assignPlayerToTeam({
    roomId,
    playerId: 'a',
    teamId: 'red',
    eligiblePlayerIds: ['a', 'b', 'c', 'd'],
  });
  const snap = syncPregameTeamsWithRoster(roomId, ['a', 'b', 'c', 'd', 'e']);
  assert.ok(snap);
  assert.ok(snap.unassignedPlayerIds.includes('e'));
});

run('start validation accepts default GC composition', () => {
  clearPregameTeams(roomId);
  configurePregameTeams({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '2v2',
    eligiblePlayerIds: ['a', 'b', 'c', 'd'],
    preserveManual: false,
  });
  const result = validatePregameTeamsForStart({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '2v2',
    eligiblePlayerIds: ['a', 'b', 'c', 'd'],
  });
  assert.ok(result.success);
  assert.deepEqual(result.data.teamByPlayerId, assignTeams(['a', 'b', 'c', 'd'], '2v2').teamByPlayerId);
});

run('start validation rejects incomplete teams', () => {
  clearPregameTeams(roomId);
  configurePregameTeams({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '2v2',
    eligiblePlayerIds: ['a', 'b', 'c', 'd'],
    preserveManual: false,
  });
  removePlayerFromPregameTeams(roomId, 'd', ['a', 'b', 'c']);
  const result = validatePregameTeamsForStart({
    roomId,
    gameId: GUESSING_CHALLENGE_GAME_ID,
    mode: '2v2',
    eligiblePlayerIds: ['a', 'b', 'c', 'd'],
  });
  assert.equal(result.success, false);
});

console.log('\npregame-teams unit done');
