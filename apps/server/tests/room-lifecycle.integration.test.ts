/**
 * Core Room lifecycle multi-client integration suite.
 * Requires server on localhost:4001 with WANASATNA_TEST_MODE=1.
 *
 * Run: pnpm --filter @wanasatna/server test:room-lifecycle
 */
import assert from 'node:assert/strict';
import {
  DRAW_GUESS_GAME_ID,
  GAME_SHELL_END_EVENT,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
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
  sleep,
  trackClientEvents,
  waitFor,
  waitForServer,
  type RosterPlayer,
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

function rosterKey(players: RosterPlayer[]): string {
  return [...players]
    .map((p) => `${p.id}:${p.status}:${p.isHost ? 'H' : '-'}`)
    .sort()
    .join('|');
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
      players: RosterPlayer[];
      reconnectToken?: string;
    };
  }>(host.socket, 'create-room', { playerName: host.name });

  assert.ok(createRes.success, 'create-room succeeds');
  host.id = createRes.data.player.id;
  host.roomId = createRes.data.room.id;
  host.roomCode = createRes.data.room.code;
  host.reconnectToken = createRes.data.reconnectToken ?? '';
  host.rosterPlayers = createRes.data.players;
  host.roster = createRes.data.players.map((p) => p.name).sort();
  assert.ok(host.reconnectToken);
  return host;
}

async function joinPlayer(roomCode: string, name: string): Promise<TestClient> {
  const client = emptyClient(name);
  client.socket = await connectClient();
  trackClientEvents(client);

  const joinRes = await ack<{
    success: boolean;
    data: {
      room: { id: string };
      player: { id: string };
      players: RosterPlayer[];
      reconnectToken?: string;
    };
    error?: { code: string };
  }>(client.socket, 'join-room', { roomCode, playerName: name });

  assert.ok(joinRes.success, `${name} join succeeds`);
  client.id = joinRes.data.player.id;
  client.roomId = joinRes.data.room.id;
  client.roomCode = roomCode;
  client.reconnectToken = joinRes.data.reconnectToken ?? '';
  client.rosterPlayers = joinRes.data.players;
  client.roster = joinRes.data.players.map((p) => p.name).sort();
  assert.ok(client.reconnectToken);
  return client;
}

async function syncRoom(client: TestClient): Promise<RosterPlayer[]> {
  const res = await ack<{
    success: boolean;
    data?: { players: RosterPlayer[]; player: { id: string }; room: { id: string } };
    error?: { code: string };
  }>(client.socket, ROOM_SYNC_EVENT, {});

  assert.ok(res.success, `room-sync for ${client.name}: ${res.error?.code ?? ''}`);
  assert.ok(res.data);
  client.rosterPlayers = res.data.players;
  client.roster = res.data.players.map((p) => p.name).sort();
  return res.data.players;
}

async function waitForRosterConvergence(
  clients: TestClient[],
  expectedCount: number,
  label: string,
): Promise<void> {
  await waitFor(
    async () => {
      const snapshots = await Promise.all(clients.map((c) => syncRoom(c)));
      if (snapshots.some((s) => s.length !== expectedCount)) {
        return null;
      }

      const keys = snapshots.map(rosterKey);
      return keys.every((key) => key === keys[0]) ? true : null;
    },
    8000,
    label,
    150,
  );
}

async function disconnectAll(clients: TestClient[]): Promise<void> {
  for (const client of clients) {
    client.socket.disconnect();
  }
}

async function main(): Promise<void> {
  console.log('[room-lifecycle] waiting for test server...');
  await waitForServer();

  await runTest('1 create room → host sees 1 player', async () => {
    const host = await createHost('مضيف');
    assert.equal(host.rosterPlayers.length, 1);
    assert.equal(host.rosterPlayers[0]?.id, host.id);
    await disconnectAll([host]);
  });

  await runTest('2 Player B joins → both see 2', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');

    await waitFor(
      async () => (host.rosterPlayers.some((p) => p.id === b.id) ? true : null),
      5000,
      'host receives B via snapshot',
      100,
    );

    await waitForRosterConvergence([host, b], 2, 'host+B converge');
    await disconnectAll([host, b]);
  });

  await runTest('3 B disconnects → host sees DISCONNECTED', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await waitForRosterConvergence([host, b], 2, 'pre-disconnect converge');

    await disconnectClient(b);

    await waitFor(
      async () => {
        const players = await syncRoom(host);
        const entry = players.find((p) => p.id === b.id);
        return entry?.status === 'DISCONNECTED' ? true : null;
      },
      5000,
      'B marked DISCONNECTED',
      100,
    );

    await disconnectAll([host]);
  });

  await runTest('4 B reconnects → same playerId + CONNECTED', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    const originalId = b.id;

    await disconnectClient(b);
    await reconnectClient(b);

    assert.equal(b.id, originalId);
    await waitForRosterConvergence([host, b], 2, 'post-reconnect converge');

    const hostView = await syncRoom(host);
    assert.equal(hostView.find((p) => p.id === b.id)?.status, 'CONNECTED');
    await disconnectAll([host, b]);
  });

  await runTest('5 B explicit leave → fresh join new identity', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'خالد');
    const oldId = b.id;
    const oldToken = b.reconnectToken;

    const leaveRes = await ack<{ success: boolean }>(b.socket, 'leave-room');
    assert.ok(leaveRes.success);
    b.socket.disconnect();

    await waitFor(
      async () => {
        const players = await syncRoom(host);
        return players.length === 1 && players[0]?.id === host.id ? true : null;
      },
      5000,
      'host alone after leave',
      100,
    );

    const staleSocket = await connectClient();
    const stale = await ack<{ success: boolean; error?: { code: string } }>(staleSocket, 'reconnect', {
      playerId: oldId,
      roomId: host.roomId,
      roomCode: host.roomCode,
      reconnectToken: oldToken,
    });
    assert.equal(stale.success, false);
    staleSocket.disconnect();

    const fresh = await joinPlayer(host.roomCode, 'عبدالله');
    assert.notEqual(fresh.id, oldId);
    await waitForRosterConvergence([host, fresh], 2, 'fresh identity converge');
    await disconnectAll([host, fresh]);
  });

  await runTest('6 host leave → host transfer agrees', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    const c = await joinPlayer(host.roomCode, 'لاعب-ج');
    await waitForRosterConvergence([host, b, c], 3, 'pre-transfer');

    const leaveRes = await ack<{
      success: boolean;
      data?: { hostChanged: { hostPlayerId: string } | null };
    }>(host.socket, 'leave-room');
    assert.ok(leaveRes.success);
    host.socket.disconnect();

    await waitForRosterConvergence([b, c], 2, 'post-host-leave');
    const bView = await syncRoom(b);
    const cView = await syncRoom(c);
    const hosts = bView.filter((p) => p.isHost);
    assert.equal(hosts.length, 1);
    assert.equal(cView.find((p) => p.isHost)?.id, hosts[0]?.id);
    await disconnectAll([b, c]);
  });

  await runTest('7 host kicks B → stale reconnect rejected', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    const kickedId = b.id;
    const kickedToken = b.reconnectToken;

    const kickRes = await ack<{ success: boolean }>(host.socket, 'kick-player', {
      playerId: b.id,
    });
    assert.ok(kickRes.success);

    await waitFor(
      async () => {
        const players = await syncRoom(host);
        return players.every((p) => p.id !== kickedId) ? true : null;
      },
      5000,
      'kicked player removed',
      100,
    );

    b.socket.disconnect();
    const socket = await connectClient();
    const stale = await ack<{ success: boolean; error?: { code: string } }>(socket, 'reconnect', {
      playerId: kickedId,
      roomId: host.roomId,
      roomCode: host.roomCode,
      reconnectToken: kickedToken,
    });
    assert.equal(stale.success, false);
    socket.disconnect();
    await disconnectAll([host]);
  });

  await runTest('8 lock blocks join; unlock allows join', async () => {
    const host = await createHost('مضيف');
    const lockRes = await ack<{ success: boolean }>(host.socket, 'lock-room');
    assert.ok(lockRes.success);

    const blockedSocket = await connectClient();
    const blocked = await ack<{ success: boolean; error?: { code: string } }>(
      blockedSocket,
      'join-room',
      { roomCode: host.roomCode, playerName: 'محظور' },
    );
    assert.equal(blocked.success, false);
    assert.equal(blocked.error?.code, 'ROOM_LOCKED');
    blockedSocket.disconnect();

    const unlockRes = await ack<{ success: boolean }>(host.socket, 'unlock-room');
    assert.ok(unlockRes.success);

    const b = await joinPlayer(host.roomCode, 'مسموح');
    await waitForRosterConvergence([host, b], 2, 'post-unlock join');
    await disconnectAll([host, b]);
  });

  await runTest('9 CRITICAL end-game → lobby roster + second game', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await waitForRosterConvergence([host, b], 2, 'pre-game');

    const start1 = await ack<{ success: boolean; error?: { code: string } }>(
      host.socket,
      GAME_SHELL_START_FROM_LOBBY_EVENT,
      { gameId: DRAW_GUESS_GAME_ID },
    );
    assert.ok(start1.success, `start game 1: ${start1.error?.code ?? ''}`);

    await waitFor(
      async () =>
        host.shellEvents.some((e) => e.phase === 'PLAYING') &&
        b.shellEvents.some((e) => e.phase === 'PLAYING')
          ? true
          : null,
      15000,
      'both in PLAYING',
      200,
    );

    await hostEndGame(host);

    await waitFor(
      async () =>
        host.navigations.includes('/lobby') && b.navigations.includes('/lobby') ? true : null,
      5000,
      'both navigate lobby',
      100,
    );

    // Simulate client remount resync (room-sync) after end-game navigation.
    await waitForRosterConvergence([host, b], 2, 'post-end-game roster');

    const hostLobby = await syncRoom(host);
    const bLobby = await syncRoom(b);
    assert.equal(hostLobby.length, 2);
    assert.equal(bLobby.length, 2);
    assert.ok(hostLobby.every((p) => p.status === 'CONNECTED'));
    assert.ok(bLobby.every((p) => p.status === 'CONNECTED'));
    assert.equal(rosterKey(hostLobby), rosterKey(bLobby));

    host.shellEvents.length = 0;
    b.shellEvents.length = 0;

    const start2 = await ack<{ success: boolean; error?: { code: string } }>(
      host.socket,
      GAME_SHELL_START_FROM_LOBBY_EVENT,
      { gameId: DRAW_GUESS_GAME_ID },
    );
    assert.ok(start2.success, `start game 2: ${start2.error?.code ?? ''}`);

    await waitFor(
      async () =>
        host.shellEvents.some((e) => e.phase === 'PLAYING') &&
        b.shellEvents.some((e) => e.phase === 'PLAYING')
          ? true
          : null,
      15000,
      'second game PLAYING',
      200,
    );

    await disconnectAll([host, b]);
  });

  await runTest('10 three clients identical roster after end-game', async () => {
    const { host, clients } = await startThreePlayerMatch();
    await hostEndGame(host);
    await waitForRosterConvergence(clients, 3, '3-player post-end converge');
    await disconnectAll(clients);
  });

  await runTest('11 disconnect during game → end → reconnect converges', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');

    const start = await ack<{ success: boolean }>(host.socket, GAME_SHELL_START_FROM_LOBBY_EVENT, {
      gameId: DRAW_GUESS_GAME_ID,
    });
    assert.ok(start.success);

    await waitFor(
      async () => (host.shellEvents.some((e) => e.phase === 'PLAYING') ? true : null),
      15000,
      'playing before disconnect',
      200,
    );

    await disconnectClient(b);
    await hostEndGame(host);
    await reconnectClient(b);
    await waitForRosterConvergence([host, b], 2, 'reconnect after end-game');
    await disconnectAll([host, b]);
  });

  await runTest('12 end-game → B leaves → host sees removal', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    const start = await ack<{ success: boolean }>(host.socket, GAME_SHELL_START_FROM_LOBBY_EVENT, {
      gameId: DRAW_GUESS_GAME_ID,
    });
    assert.ok(start.success);
    await waitFor(
      async () => (host.shellEvents.some((e) => e.phase === 'PLAYING') ? true : null),
      15000,
      'playing',
      200,
    );
    await hostEndGame(host);
    await waitForRosterConvergence([host, b], 2, 'lobby after end');

    const leaveRes = await ack<{ success: boolean }>(b.socket, 'leave-room');
    assert.ok(leaveRes.success);
    b.socket.disconnect();

    await waitFor(
      async () => {
        const players = await syncRoom(host);
        return players.length === 1 ? true : null;
      },
      5000,
      'host alone',
      100,
    );
    await disconnectAll([host]);
  });

  await runTest('13 end-game → C joins → host sees C', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    const start = await ack<{ success: boolean }>(host.socket, GAME_SHELL_START_FROM_LOBBY_EVENT, {
      gameId: DRAW_GUESS_GAME_ID,
    });
    assert.ok(start.success);
    await waitFor(
      async () => (host.shellEvents.some((e) => e.phase === 'PLAYING') ? true : null),
      15000,
      'playing',
      200,
    );
    await hostEndGame(host);
    await waitForRosterConvergence([host, b], 2, 'lobby');

    const c = await joinPlayer(host.roomCode, 'لاعب-ج');
    await waitFor(
      async () => (host.rosterPlayers.some((p) => p.id === c.id) ? true : null),
      5000,
      'host sees C snapshot',
      100,
    );
    await waitForRosterConvergence([host, b, c], 3, 'with C');
    await disconnectAll([host, b, c]);
  });

  await runTest('14 Room A leave → Room B clean', async () => {
    const hostA = await createHost('مضيف-أ');
    const bA = await joinPlayer(hostA.roomCode, 'ب-أ');
    await ack(bA.socket, 'leave-room');
    await ack(hostA.socket, 'leave-room');
    bA.socket.disconnect();
    hostA.socket.disconnect();

    const hostB = await createHost('مضيف-ب');
    const bB = await joinPlayer(hostB.roomCode, 'ب-ب');
    assert.notEqual(hostB.roomId, hostA.roomId);
    assert.notEqual(hostB.roomCode, hostA.roomCode);
    await waitForRosterConvergence([hostB, bB], 2, 'room B only');
    assert.ok(hostB.rosterPlayers.every((p) => p.id === hostB.id || p.id === bB.id));
    await disconnectAll([hostB, bB]);
  });

  await runTest('15 same browser identity reset across rooms', async () => {
    const host = await createHost('مضيف');
    const first = await joinPlayer(host.roomCode, 'خالد');
    const firstId = first.id;
    await ack(first.socket, 'leave-room');
    first.socket.disconnect();

    const second = await joinPlayer(host.roomCode, 'سارة');
    assert.notEqual(second.id, firstId);
    assert.equal(second.name, 'سارة');
    await disconnectAll([host, second]);
  });

  await runTest('16 old socket disconnect after new reconnect keeps CONNECTED', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    const oldSocket = b.socket;

    b.socket = await connectClient();
    trackClientEvents(b);
    const recon = await ack<{ success: boolean }>(b.socket, 'reconnect', {
      playerId: b.id,
      roomId: b.roomId,
      roomCode: b.roomCode,
      reconnectToken: b.reconnectToken,
    });
    assert.ok(recon.success);

    oldSocket.disconnect();
    await sleep(300);

    const hostView = await syncRoom(host);
    assert.equal(hostView.find((p) => p.id === b.id)?.status, 'CONNECTED');
    await disconnectAll([host, b]);
  });

  await runTest('17 repeated reconnect → no duplicate players', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');

    for (let i = 0; i < 4; i += 1) {
      await disconnectClient(b);
      await reconnectClient(b);
    }

    const players = await syncRoom(host);
    assert.equal(players.length, 2);
    assert.equal(new Set(players.map((p) => p.id)).size, 2);
    await disconnectAll([host, b]);
  });

  await runTest('18 room-sync after end-game restores membership', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    const start = await ack<{ success: boolean }>(host.socket, GAME_SHELL_START_FROM_LOBBY_EVENT, {
      gameId: DRAW_GUESS_GAME_ID,
    });
    assert.ok(start.success);
    await waitFor(
      async () => (host.shellEvents.some((e) => e.phase === 'PLAYING') ? true : null),
      15000,
      'playing',
      200,
    );

    const endRes = await ack<{ success: boolean }>(host.socket, GAME_SHELL_END_EVENT);
    assert.ok(endRes.success);

    const synced = await syncRoom(b);
    assert.equal(synced.length, 2);
    assert.ok(synced.some((p) => p.id === host.id));
    assert.ok(synced.some((p) => p.id === b.id));
    await disconnectAll([host, b]);
  });

  await runTest('19 empty room cleanup → stale reconnect rejected', async () => {
    const host = await createHost('مضيف');
    const roomId = host.roomId;
    const roomCode = host.roomCode;
    const playerId = host.id;
    const token = host.reconnectToken;

    const leaveRes = await ack<{ success: boolean; data?: { roomDeleted: boolean } }>(
      host.socket,
      'leave-room',
    );
    assert.ok(leaveRes.success);
    assert.equal(leaveRes.data?.roomDeleted, true);
    host.socket.disconnect();

    const socket = await connectClient();
    const stale = await ack<{ success: boolean; error?: { code: string } }>(socket, 'reconnect', {
      playerId,
      roomId,
      roomCode,
      reconnectToken: token,
    });
    assert.equal(stale.success, false);
    socket.disconnect();
  });

  await runTest('20 non-empty room survives cleanup path', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');

    const leaveRes = await ack<{ success: boolean; data?: { roomDeleted: boolean } }>(
      b.socket,
      'leave-room',
    );
    assert.ok(leaveRes.success);
    assert.equal(leaveRes.data?.roomDeleted, false);
    b.socket.disconnect();

    const stillThere = await syncRoom(host);
    assert.equal(stillThere.length, 1);
    assert.equal(stillThere[0]?.id, host.id);
    await disconnectAll([host]);
  });

  await runTest('race join + host sync sees joiner', async () => {
    const host = await createHost('مضيف');
    const bPromise = joinPlayer(host.roomCode, 'سريع');
    const b = await bPromise;

    await waitFor(
      async () => {
        const players = await syncRoom(host);
        return players.some((p) => p.id === b.id) ? true : null;
      },
      5000,
      'host sync sees joiner',
      50,
    );
    await disconnectAll([host, b]);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('room-lifecycle suite crashed:', error);
  process.exit(1);
});
