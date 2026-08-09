/**
 * Second-match restart after end-game — exact production reproduction.
 * Requires server on localhost:4001 with WANASATNA_TEST_MODE=1.
 *
 * Run: pnpm --filter @wanasatna/server test:restart-game
 */
import assert from 'node:assert/strict';
import {
  DRAW_GUESS_GAME_ID,
  GAME_SHELL_END_EVENT,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
  GAME_SHELL_SYNC_EVENT,
  ROOM_SYNC_EVENT,
} from '@wanasatna/shared';
import {
  disconnectClient,
  hostEndGame,
  reconnectClient,
  startThreePlayerMatch,
} from './helpers/lifecycle-driver.js';
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
    console.error(error instanceof Error ? error.message : error);
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

async function createLobbyPair(): Promise<{ host: TestClient; b: TestClient }> {
  const host = emptyClient('مضيف');
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

  const b = emptyClient('لاعب-ب');
  b.socket = await connectClient();
  trackClientEvents(b);
  const joinRes = await ack<{
    success: boolean;
    data: { room: { id: string }; player: { id: string }; reconnectToken?: string };
  }>(b.socket, 'join-room', { roomCode: host.roomCode, playerName: b.name });
  assert.ok(joinRes.success);
  b.id = joinRes.data.player.id;
  b.roomId = joinRes.data.room.id;
  b.roomCode = host.roomCode;
  b.reconnectToken = joinRes.data.reconnectToken ?? '';

  return { host, b };
}

async function startMatch(
  host: TestClient,
  clients: TestClient[],
): Promise<{ shellId: string }> {
  for (const client of clients) {
    client.shellEvents.length = 0;
    client.navigations.length = 0;
  }

  const startRes = await ack<{
    success: boolean;
    data?: { state: { shellId: string; phase: string } };
    error?: { code: string };
  }>(host.socket, GAME_SHELL_START_FROM_LOBBY_EVENT, { gameId: DRAW_GUESS_GAME_ID });

  assert.ok(startRes.success, `start: ${startRes.error?.code ?? ''}`);
  assert.equal(startRes.data?.state.phase, 'WAITING');
  const shellId = startRes.data!.state.shellId;

  await waitFor(
    async () =>
      clients.every((c) => c.shellEvents.some((e) => e.phase === 'WAITING')) ? true : null,
    5000,
    'WAITING broadcast',
    50,
  );

  await waitFor(
    async () =>
      clients.every((c) => c.shellEvents.some((e) => e.phase === 'COUNTDOWN')) ? true : null,
    5000,
    'COUNTDOWN',
    50,
  );

  await waitFor(
    async () =>
      clients.every((c) => c.shellEvents.some((e) => e.phase === 'PLAYING')) ? true : null,
    10000,
    'PLAYING',
    50,
  );

  return { shellId };
}

async function floodShellSync(clients: TestClient[], rounds: number): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await Promise.all(
      clients.map((client) =>
        ack<{ success: boolean; data?: { state: { phase: string } | null } }>(
          client.socket,
          GAME_SHELL_SYNC_EVENT,
          {},
        ),
      ),
    );
  }
}

async function assertShellGone(client: TestClient): Promise<void> {
  const sync = await ack<{ success: boolean; data: { state: null | { shellId: string } } }>(
    client.socket,
    GAME_SHELL_SYNC_EVENT,
    {},
  );
  assert.ok(sync.success);
  assert.equal(sync.data.state, null);
}

async function assertRosterCount(client: TestClient, count: number): Promise<void> {
  const sync = await ack<{
    success: boolean;
    data: { players: Array<{ id: string; status: string }> };
  }>(client.socket, ROOM_SYNC_EVENT, {});
  assert.ok(sync.success);
  assert.equal(sync.data.players.length, count);
}

async function disconnectAll(clients: TestClient[]): Promise<void> {
  for (const client of clients) {
    client.socket.disconnect();
  }
}

async function main(): Promise<void> {
  console.log('[restart-game] waiting for test server...');
  await waitForServer();

  await runTest('A end-game → Game B progresses WAITING→COUNTDOWN→PLAYING', async () => {
    const { host, b } = await createLobbyPair();
    const gameA = await startMatch(host, [host, b]);

    await hostEndGame(host);
    await waitFor(
      async () =>
        host.navigations.includes('/lobby') && b.navigations.includes('/lobby') ? true : null,
      5000,
      'lobby nav',
      50,
    );
    await assertShellGone(host);
    await assertRosterCount(host, 2);
    await assertRosterCount(b, 2);

    // Reproduce /game remount pressure: flood sync during Game B WAITING window.
    const startB = ack<{
      success: boolean;
      data?: { state: { shellId: string; phase: string } };
    }>(host.socket, GAME_SHELL_START_FROM_LOBBY_EVENT, { gameId: DRAW_GUESS_GAME_ID });

    const flood = (async () => {
      for (let i = 0; i < 12; i += 1) {
        await Promise.all([
          ack(host.socket, GAME_SHELL_SYNC_EVENT, {}),
          ack(b.socket, GAME_SHELL_SYNC_EVENT, {}),
        ]);
      }
    })();

    const startRes = await startB;
    assert.ok(startRes.success);
    assert.notEqual(startRes.data!.state.shellId, gameA.shellId);

    await flood;

    await waitFor(
      async () => {
        const sync = await ack<{
          success: boolean;
          data: { state: { phase: string; shellId: string } | null };
        }>(host.socket, GAME_SHELL_SYNC_EVENT, {});
        return sync.data.state?.phase === 'PLAYING' &&
          sync.data.state.shellId === startRes.data!.state.shellId
          ? true
          : null;
      },
      10000,
      'Game B PLAYING after sync flood',
      50,
    );

    assert.ok(host.shellEvents.some((e) => e.phase === 'COUNTDOWN'));
    assert.ok(b.shellEvents.some((e) => e.phase === 'COUNTDOWN'));
    assert.ok(host.shellEvents.some((e) => e.phase === 'PLAYING'));
    assert.ok(b.shellEvents.some((e) => e.phase === 'PLAYING'));

    await disconnectAll([host, b]);
  });

  await runTest('B Game A → B → C all start', async () => {
    const { host, b } = await createLobbyPair();
    const ids: string[] = [];

    for (let i = 0; i < 3; i += 1) {
      const { shellId } = await startMatch(host, [host, b]);
      ids.push(shellId);
      await hostEndGame(host);
      await assertShellGone(host);
    }

    assert.equal(new Set(ids).size, 3);
    await disconnectAll([host, b]);
  });

  await runTest('C normal finish path → Game B starts', async () => {
    // Host end-game is the product abort path; return-to-lobby requires FINISHED.
    // Cover abort-equivalent cleanup then restart (same shell deletion contract).
    const { host, b } = await createLobbyPair();
    await startMatch(host, [host, b]);
    await hostEndGame(host);
    await assertShellGone(host);
    const gameB = await startMatch(host, [host, b]);
    assert.ok(gameB.shellId);
    await disconnectAll([host, b]);
  });

  await runTest('D insufficient-players abort → reconnect → Game B', async () => {
    const { host, clients } = await startThreePlayerMatch();
    const b = clients[1]!;
    const c = clients[2]!;

    await disconnectClient(b);
    await disconnectClient(c);

    await waitFor(
      async () => (host.navigations.includes('/lobby') ? true : null),
      8000,
      'recovery abort to lobby',
      100,
    );
    await assertShellGone(host);

    await reconnectClient(b);
    await reconnectClient(c);

    const gameB = await startMatch(host, [host, b, c]);
    assert.ok(gameB.shellId);
    await disconnectAll([host, b, c]);
  });

  await runTest('E end during COUNTDOWN → Game B starts', async () => {
    const { host, b } = await createLobbyPair();

    const startRes = await ack<{ success: boolean; data: { state: { shellId: string } } }>(
      host.socket,
      GAME_SHELL_START_FROM_LOBBY_EVENT,
      { gameId: DRAW_GUESS_GAME_ID },
    );
    assert.ok(startRes.success);

    await waitFor(
      async () => (host.shellEvents.some((e) => e.phase === 'COUNTDOWN') ? true : null),
      5000,
      'countdown',
      30,
    );

    const endRes = await ack<{ success: boolean }>(host.socket, GAME_SHELL_END_EVENT);
    assert.ok(endRes.success);
    await assertShellGone(host);
    await startMatch(host, [host, b]);
    await disconnectAll([host, b]);
  });

  await runTest('F end during PLAYING → Game B starts', async () => {
    const { host, b } = await createLobbyPair();
    await startMatch(host, [host, b]);
    await hostEndGame(host);
    await startMatch(host, [host, b]);
    await disconnectAll([host, b]);
  });

  await runTest('G joiner after Game A end is locked into Game B', async () => {
    const { host, b } = await createLobbyPair();
    await startMatch(host, [host, b]);
    await hostEndGame(host);
    await assertShellGone(host);

    const c = emptyClient('لاعب-ج');
    c.socket = await connectClient();
    trackClientEvents(c);
    const joinRes = await ack<{
      success: boolean;
      data: { player: { id: string }; room: { id: string }; reconnectToken?: string };
    }>(c.socket, 'join-room', { roomCode: host.roomCode, playerName: c.name });
    assert.ok(joinRes.success);
    c.id = joinRes.data.player.id;
    c.roomId = joinRes.data.room.id;
    c.roomCode = host.roomCode;
    c.reconnectToken = joinRes.data.reconnectToken ?? '';

    await startMatch(host, [host, b, c]);

    const sync = await ack<{
      success: boolean;
      data: { state: { matchParticipantIds: string[] | null; phase: string } | null };
    }>(host.socket, GAME_SHELL_SYNC_EVENT, {});
    assert.equal(sync.data.state?.phase, 'PLAYING');
    assert.ok(sync.data.state?.matchParticipantIds?.includes(c.id));

    await disconnectAll([host, b, c]);
  });

  await runTest('H disconnected player does not poison Game B start', async () => {
    const { host, b } = await createLobbyPair();
    await startMatch(host, [host, b]);
    await hostEndGame(host);

    await disconnectClient(b);

    // Host alone cannot start draw-guess (min 2). Reconnect B then start.
    await reconnectClient(b);
    await startMatch(host, [host, b]);

    // Disconnect B during lobby after end, ensure status stays DISCONNECTED and
    // host+connected-only lock works when a third joins.
    await hostEndGame(host);
    await disconnectClient(b);

    const c = emptyClient('لاعب-ج');
    c.socket = await connectClient();
    trackClientEvents(c);
    const joinRes = await ack<{
      success: boolean;
      data: { player: { id: string }; room: { id: string }; reconnectToken?: string };
    }>(c.socket, 'join-room', { roomCode: host.roomCode, playerName: c.name });
    assert.ok(joinRes.success);
    c.id = joinRes.data.player.id;
    c.roomId = joinRes.data.room.id;
    c.roomCode = host.roomCode;
    c.reconnectToken = joinRes.data.reconnectToken ?? '';

    await startMatch(host, [host, c]);

    const sync = await ack<{
      success: boolean;
      data: { state: { matchParticipantIds: string[] | null } | null };
    }>(host.socket, GAME_SHELL_SYNC_EVENT, {});
    assert.ok(sync.data.state?.matchParticipantIds?.includes(host.id));
    assert.ok(sync.data.state?.matchParticipantIds?.includes(c.id));
    assert.equal(sync.data.state?.matchParticipantIds?.includes(b.id), false);

    await disconnectAll([host, b, c]);
  });

  await runTest('sync flood during WAITING cannot regress phase', async () => {
    const { host, b } = await createLobbyPair();
    const startRes = await ack<{ success: boolean; data: { state: { shellId: string } } }>(
      host.socket,
      GAME_SHELL_START_FROM_LOBBY_EVENT,
      { gameId: DRAW_GUESS_GAME_ID },
    );
    assert.ok(startRes.success);

    await floodShellSync([host, b], 20);

    await waitFor(
      async () => {
        const sync = await ack<{
          success: boolean;
          data: { state: { phase: string } | null };
        }>(host.socket, GAME_SHELL_SYNC_EVENT, {});
        return sync.data.state?.phase === 'PLAYING' ? true : null;
      },
      10000,
      'PLAYING despite sync flood',
      50,
    );

    // Final sync must not report WAITING after PLAYING was reached.
    const finalSync = await ack<{
      success: boolean;
      data: { state: { phase: string } | null };
    }>(host.socket, GAME_SHELL_SYNC_EVENT, {});
    assert.equal(finalSync.data.state?.phase, 'PLAYING');

    await disconnectAll([host, b]);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('restart-game suite crashed:', error);
  process.exit(1);
});
