/**
 * Multi-client Pregame Team System integration tests.
 * Requires server on :4001 with WANASATNA_TEST_MODE=1.
 */
import assert from 'node:assert/strict';
import {
  GUESSING_CHALLENGE_GAME_ID,
  TEAM_ASSIGN_EVENT,
  TEAM_CONFIGURE_EVENT,
  TEAM_RANDOMIZE_EVENT,
  TEAM_SNAPSHOT_EVENT,
  TEAM_SYNC_EVENT,
  type PregameTeamSnapshot,
} from '@wanasatna/shared';
import {
  ack,
  connectClient,
  trackClientEvents,
  waitFor,
  waitForServer,
  type TestClient,
} from './helpers/socket-utils.js';

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : error);
  }
}

function emptyClient(name: string): TestClient {
  return {
    name,
    socket: undefined as never,
    id: '',
    roomId: '',
    roomCode: '',
    reconnectToken: '',
    shellEvents: [],
    roster: [],
    rosterPlayers: [],
    navigations: [],
    recoveryEvents: [],
  };
}

async function createHost(name: string): Promise<TestClient> {
  const host = emptyClient(name);
  host.socket = await connectClient();
  trackClientEvents(host);
  const createRes = await ack<{
    success: boolean;
    data: {
      room: { code: string; id: string };
      player: { id: string };
      reconnectToken?: string;
    };
  }>(host.socket, 'create-room', { playerName: host.name });
  assert.ok(createRes.success);
  host.id = createRes.data.player.id;
  host.roomId = createRes.data.room.id;
  host.roomCode = createRes.data.room.code;
  host.reconnectToken = createRes.data.reconnectToken ?? '';
  return host;
}

async function joinPlayer(roomCode: string, name: string): Promise<TestClient> {
  const client = emptyClient(name);
  client.socket = await connectClient();
  trackClientEvents(client);
  const joinRes = await ack<{
    success: boolean;
    data: { room: { id: string }; player: { id: string }; reconnectToken?: string };
  }>(client.socket, 'join-room', { roomCode, playerName: name });
  assert.ok(joinRes.success);
  client.id = joinRes.data.player.id;
  client.roomId = joinRes.data.room.id;
  client.roomCode = roomCode;
  client.reconnectToken = joinRes.data.reconnectToken ?? '';
  return client;
}

function trackTeamSnapshot(client: TestClient & { teamSnapshots: PregameTeamSnapshot[] }): void {
  client.socket.on(TEAM_SNAPSHOT_EVENT, (payload: PregameTeamSnapshot) => {
    client.teamSnapshots.push(payload);
  });
}

function snapshotKey(snap: PregameTeamSnapshot): string {
  return [...snap.assignments]
    .map((a) => `${a.playerId}:${a.teamId}:${a.seat}`)
    .sort()
    .join('|');
}

async function main(): Promise<void> {
  await waitForServer();

  await runTest('2v2 four clients converge on default teams', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    const c = await joinPlayer(host.roomCode, 'لاعب-ج');
    const d = await joinPlayer(host.roomCode, 'لاعب-د');
    const all = [host, b, c, d].map((client) => {
      const extended = client as TestClient & { teamSnapshots: PregameTeamSnapshot[] };
      extended.teamSnapshots = [];
      trackTeamSnapshot(extended);
      return extended;
    });

    const configured = await ack<{ success: boolean; data?: PregameTeamSnapshot; error?: { code: string; message: string } }>(
      host.socket,
      TEAM_CONFIGURE_EVENT,
      { gameId: GUESSING_CHALLENGE_GAME_ID, mode: '2v2' },
    );
    if (!configured.success) {
      throw new Error(`configure failed: ${configured.error?.code} ${configured.error?.message}`);
    }
    assert.equal(configured.data!.assignments.length, 4);

    await waitFor(
      async () => {
        if (all.some((client) => client.teamSnapshots.length === 0)) {
          return null;
        }
        const keys = all.map((client) => snapshotKey(client.teamSnapshots.at(-1)!));
        return keys.every((key) => key === keys[0]) ? true : null;
      },
      5000,
      'team snapshot convergence',
      50,
    );

    const snap = configured.data;
    assert.deepEqual(
      snap.assignments.filter((e) => e.teamId === 'blue').map((e) => e.playerId),
      [host.id, c.id],
    );
    assert.deepEqual(
      snap.assignments.filter((e) => e.teamId === 'red').map((e) => e.playerId),
      [b.id, d.id],
    );

    for (const client of all) {
      client.socket.disconnect();
    }
  });

  await runTest('host move converges; full-team unassigned rejects', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    const c = await joinPlayer(host.roomCode, 'لاعب-ج');
    const d = await joinPlayer(host.roomCode, 'لاعب-د');
    const all = [host, b, c, d].map((client) => {
      const extended = client as TestClient & { teamSnapshots: PregameTeamSnapshot[] };
      extended.teamSnapshots = [];
      trackTeamSnapshot(extended);
      return extended;
    });

    await ack(host.socket, TEAM_CONFIGURE_EVENT, {
      gameId: GUESSING_CHALLENGE_GAME_ID,
      mode: '2v2',
    });

    // Cross-team move into a full team swaps and converges on all clients.
    const moved = await ack<{ success: boolean; data: PregameTeamSnapshot }>(
      host.socket,
      TEAM_ASSIGN_EVENT,
      { playerId: c.id, teamId: 'red' },
    );
    assert.ok(moved.success);
    assert.equal(moved.data.assignments.find((e) => e.playerId === c.id)?.teamId, 'red');

    await waitFor(
      async () => {
        if (all.some((client) => client.teamSnapshots.length === 0)) {
          return null;
        }
        const keys = all.map((client) => snapshotKey(client.teamSnapshots.at(-1)!));
        return keys.every((key) => key === keys[0]) ? true : null;
      },
      5000,
      'post-move snapshot convergence',
      50,
    );

    const movedBack = await ack<{ success: boolean; data: PregameTeamSnapshot }>(
      host.socket,
      TEAM_ASSIGN_EVENT,
      { playerId: c.id, teamId: 'blue' },
    );
    assert.ok(movedBack.success);
    assert.equal(movedBack.data.assignments.find((e) => e.playerId === c.id)?.teamId, 'blue');

    // Unassigned → full team: leave one player unassigned via 1v1 + third joiner path
    await ack(host.socket, TEAM_CONFIGURE_EVENT, {
      gameId: GUESSING_CHALLENGE_GAME_ID,
      mode: '1v1',
    });
    // After mode shrink, extras may be unassigned; assign an unassigned id into full blue.
    const snap1v1 = await ack<{ success: boolean; data: { snapshot: PregameTeamSnapshot | null } }>(
      host.socket,
      TEAM_SYNC_EVENT,
    );
    assert.ok(snap1v1.success);
    const unassigned = snap1v1.data.snapshot?.unassignedPlayerIds[0];
    assert.ok(unassigned, 'expected an unassigned player after 1v1 shrink');
    const before = snapshotKey(snap1v1.data.snapshot!);
    const rejected = await ack<{ success: boolean; error?: { code: string } }>(
      host.socket,
      TEAM_ASSIGN_EVENT,
      { playerId: unassigned, teamId: 'blue' },
    );
    assert.equal(rejected.success, false);
    assert.equal(rejected.error?.code, 'TEAM_FULL');
    const after = await ack<{ success: boolean; data: { snapshot: PregameTeamSnapshot | null } }>(
      host.socket,
      TEAM_SYNC_EVENT,
    );
    assert.ok(after.success);
    assert.equal(snapshotKey(after.data.snapshot!), before);

    for (const client of all) {
      client.socket.disconnect();
    }
  });

  await runTest('non-host assign rejected', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await ack(host.socket, TEAM_CONFIGURE_EVENT, {
      gameId: GUESSING_CHALLENGE_GAME_ID,
      mode: '1v1',
    });

    const denied = await ack<{ success: boolean; error?: { code: string } }>(
      b.socket,
      TEAM_ASSIGN_EVENT,
      { playerId: b.id, teamId: 'blue' },
    );
    assert.equal(denied.success, false);
    assert.equal(denied.error?.code, 'NOT_HOST');

    host.socket.disconnect();
    b.socket.disconnect();
  });

  await runTest('randomize balanced on all clients', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    const c = await joinPlayer(host.roomCode, 'لاعب-ج');
    const d = await joinPlayer(host.roomCode, 'لاعب-د');
    await ack(host.socket, TEAM_CONFIGURE_EVENT, {
      gameId: GUESSING_CHALLENGE_GAME_ID,
      mode: '2v2',
    });

    const randomized = await ack<{ success: boolean; data: PregameTeamSnapshot }>(
      host.socket,
      TEAM_RANDOMIZE_EVENT,
    );
    assert.ok(randomized.success);
    assert.equal(randomized.data.assignments.filter((e) => e.teamId === 'blue').length, 2);
    assert.equal(randomized.data.assignments.filter((e) => e.teamId === 'red').length, 2);

    for (const client of [b, c, d]) {
      const sync = await ack<{ success: boolean; data: { snapshot: PregameTeamSnapshot | null } }>(
        client.socket,
        TEAM_SYNC_EVENT,
      );
      assert.ok(sync.success);
      assert.equal(snapshotKey(sync.data.snapshot!), snapshotKey(randomized.data));
    }

    for (const client of [host, b, c, d]) {
      client.socket.disconnect();
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
