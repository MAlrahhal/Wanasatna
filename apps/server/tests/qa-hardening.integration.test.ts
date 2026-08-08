/**
 * QA hardening integration tests (H2 + M2).
 *
 * H2 — plugin initialization with zero connected match participants must be
 *      caught: the affected match is aborted safely and the Node process
 *      survives (previously an unhandled rejection crashed the server).
 * M2 — detached lobby→countdown lifecycle work must never produce an
 *      unhandled rejection, even when the room dissolves mid-transition.
 *
 * Both tests fail if an unhandled rejection escapes, because on Node 22 the
 * server process dies and the follow-up health/room assertions fail.
 *
 * Requires server on localhost:4001 with WANASATNA_TEST_MODE=1.
 * Run: pnpm --filter @wanasatna/server test:hardening
 */
import assert from 'node:assert/strict';
import { BARA_AL_SALAFA_GAME_ID, GAME_SHELL_SYNC_EVENT } from '@wanasatna/shared';
import { startThreePlayerMatch } from './helpers/lifecycle-driver.js';
import {
  ack,
  connectClient,
  DEFAULT_SERVER_URL,
  sleep,
  trackClientEvents,
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
    console.error(error instanceof Error ? error.message : error);
  }
}

async function assertServerHealthy(label: string): Promise<void> {
  const res = await fetch(`${DEFAULT_SERVER_URL}/api/health`);
  assert.ok(res.ok, `health endpoint must respond after ${label}`);
}

function makeClient(name: string): TestClient {
  return {
    name,
    socket: undefined as never,
    id: '',
    roomId: '',
    roomCode: '',
    reconnectToken: '',
    shellEvents: [],
    roster: [],
    navigations: [],
    recoveryEvents: [],
  };
}

async function createRoomWithPlayers(names: string[]): Promise<TestClient[]> {
  const clients: TestClient[] = [];

  const host = makeClient(names[0]!);
  host.socket = await connectClient();
  trackClientEvents(host);

  const createRes = await ack<{
    success: boolean;
    data: { room: { code: string; id: string }; player: { id: string }; reconnectToken?: string };
  }>(host.socket, 'create-room', { playerName: host.name });
  assert.ok(createRes.success);
  host.id = createRes.data.player.id;
  host.roomId = createRes.data.room.id;
  host.roomCode = createRes.data.room.code;
  host.reconnectToken = createRes.data.reconnectToken ?? '';
  clients.push(host);

  for (const name of names.slice(1)) {
    const client = makeClient(name);
    client.socket = await connectClient();
    trackClientEvents(client);

    const joinRes = await ack<{
      success: boolean;
      data: { player: { id: string }; room: { id: string }; reconnectToken?: string };
    }>(client.socket, 'join-room', { roomCode: host.roomCode, playerName: name });
    assert.ok(joinRes.success);
    client.id = joinRes.data.player.id;
    client.roomId = joinRes.data.room.id;
    client.roomCode = host.roomCode;
    client.reconnectToken = joinRes.data.reconnectToken ?? '';
    clients.push(client);
  }

  return clients;
}

async function main(): Promise<void> {
  console.log('[qa-hardening] waiting for test server...');
  await waitForServer();

  await runTest('H2: zero connected participants at PLAYING aborts match, server survives', async () => {
    const clients = await createRoomWithPlayers(['محمد', 'خالد', 'علي']);
    const host = clients[0]!;

    const startRes = await ack<{ success: boolean }>(host.socket, 'game-shell-start-from-lobby', {
      gameId: BARA_AL_SALAFA_GAME_ID,
    });
    assert.ok(startRes.success);

    // Everyone drops before the match reaches PLAYING. Plugin initialization
    // then runs with zero connected participants — the previous behavior was
    // an unhandled 'No connected players available.' rejection killing Node.
    for (const client of clients) {
      client.socket.disconnect();
    }

    // lobby wait (50ms) + countdown (1s) + plugin init + abort, with buffer.
    await sleep(4000);

    await assertServerHealthy('zero-participant plugin initialization');

    // The room itself must be recovered into a safe lobby state: the original
    // player can reconnect and the broken shell is gone.
    host.socket = await connectClient();
    trackClientEvents(host);
    const reconRes = await ack<{ success: boolean }>(host.socket, 'reconnect', {
      playerId: host.id,
      roomId: host.roomId,
      roomCode: host.roomCode,
      reconnectToken: host.reconnectToken,
    });
    assert.ok(reconRes.success, 'reconnect into the recovered room succeeds');

    const syncRes = await ack<{ success: boolean; data: { state: unknown } }>(
      host.socket,
      GAME_SHELL_SYNC_EVENT,
    );
    assert.ok(syncRes.success);
    assert.equal(syncRes.data.state, null, 'broken match shell was aborted');

    host.socket.disconnect();
  });

  await runTest('M2: room dissolving during lobby-wait window leaves server alive', async () => {
    const clients = await createRoomWithPlayers(['سارة', 'فهد', 'نورة']);
    const host = clients[0]!;

    const startRes = await ack<{ success: boolean }>(host.socket, 'game-shell-start-from-lobby', {
      gameId: BARA_AL_SALAFA_GAME_ID,
    });
    assert.ok(startRes.success);

    // The whole room leaves inside the lobby-wait window, so the detached
    // countdown transition wakes up against a dissolved room. Any rejection
    // here must be handled at the source.
    for (const client of [...clients].reverse()) {
      await ack<{ success: boolean }>(client.socket, 'leave-room');
    }

    await sleep(3000);

    await assertServerHealthy('lobby→countdown transition against dissolved room');

    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  await runTest('server still runs full matches after isolated room failures', async () => {
    const { host, clients } = await startThreePlayerMatch();

    // startThreePlayerMatch already asserts the match reaches PLAYING and the
    // description phase; reaching this point proves the server kept working.
    assert.ok(host.shellEvents.some((event) => event.phase === 'PLAYING'));

    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('qa-hardening suite crashed:', error);
  process.exit(1);
});
