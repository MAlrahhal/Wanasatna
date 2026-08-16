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

  await runTest('21 A+B+C roster converges on every client', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await waitForRosterConvergence([host, b], 2, 'A+B');
    const c = await joinPlayer(host.roomCode, 'لاعب-ج');
    await waitForRosterConvergence([host, b, c], 3, 'A+B+C');

    for (const client of [host, b, c]) {
      const players = await syncRoom(client);
      assert.equal(players.length, 3, `${client.name} roster size`);
      assert.equal(rosterKey(players), rosterKey(host.rosterPlayers));
      assert.ok(players.every((p) => p.status === 'CONNECTED'));
    }
    await disconnectAll([host, b, c]);
  });

  await runTest('22 A+B+C+D roster converges on every client', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    const c = await joinPlayer(host.roomCode, 'لاعب-ج');
    const d = await joinPlayer(host.roomCode, 'لاعب-د');
    await waitForRosterConvergence([host, b, c, d], 4, 'A+B+C+D');

    const keys = await Promise.all(
      [host, b, c, d].map(async (client) => rosterKey(await syncRoom(client))),
    );
    assert.ok(keys.every((key) => key === keys[0]));
    await disconnectAll([host, b, c, d]);
  });

  await runTest('23 stale in-flight room-sync ACK cannot miss concurrent joiner', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await waitForRosterConvergence([host, b], 2, 'pre');

    // Start host sync BEFORE C joins; resolve AFTER C's join snapshot.
    const syncStarted = ack<{
      success: boolean;
      data?: { players: RosterPlayer[] };
    }>(host.socket, ROOM_SYNC_EVENT, {});

    await sleep(10);
    const c = await joinPlayer(host.roomCode, 'لاعب-ج');

    await waitFor(
      async () => (host.rosterPlayers.some((p) => p.id === c.id) ? true : null),
      5000,
      'host snapshot sees C',
      50,
    );

    const syncRes = await syncStarted;
    assert.ok(syncRes.success);
    assert.ok(syncRes.data);
    assert.equal(syncRes.data.players.length, 3, 'sync ACK must include C');
    assert.ok(syncRes.data.players.some((p) => p.id === c.id));

    await waitForRosterConvergence([host, b, c], 3, 'post stale-sync race');
    await disconnectAll([host, b, c]);
  });

  await runTest('24 C disconnect/reconnect preserves 4-player roster shape', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    const c = await joinPlayer(host.roomCode, 'لاعب-ج');
    const d = await joinPlayer(host.roomCode, 'لاعب-د');
    await waitForRosterConvergence([host, b, c, d], 4, 'full');

    await disconnectClient(c);
    await waitFor(
      async () => {
        const players = await syncRoom(host);
        return players.find((p) => p.id === c.id)?.status === 'DISCONNECTED' ? true : null;
      },
      5000,
      'C disconnected',
      100,
    );

    await reconnectClient(c);
    await waitForRosterConvergence([host, b, c, d], 4, 'C reconnected');
    const players = await syncRoom(host);
    assert.equal(players.find((p) => p.id === c.id)?.status, 'CONNECTED');
    await disconnectAll([host, b, c, d]);
  });

  await runTest('25 explicit leave removes player for remaining clients', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    const c = await joinPlayer(host.roomCode, 'لاعب-ج');
    await waitForRosterConvergence([host, b, c], 3, 'three');

    const leaveRes = await ack<{ success: boolean }>(b.socket, 'leave-room');
    assert.ok(leaveRes.success);
    b.socket.disconnect();

    await waitFor(
      async () => {
        const players = await syncRoom(host);
        return players.length === 2 && !players.some((p) => p.id === b.id) ? true : null;
      },
      5000,
      'B left',
      100,
    );

    const cView = await syncRoom(c);
    assert.equal(cView.length, 2);
    assert.ok(!cView.some((p) => p.id === b.id));
    await disconnectAll([host, c]);
  });

  await runTest('26 rapid sequential join B/C/D converges', async () => {
    const host = await createHost('مضيف');
    const [b, c, d] = await Promise.all([
      joinPlayer(host.roomCode, 'لاعب-ب'),
      joinPlayer(host.roomCode, 'لاعب-ج'),
      joinPlayer(host.roomCode, 'لاعب-د'),
    ]);

    await waitForRosterConvergence([host, b, c, d], 4, 'rapid four');
    const ids = new Set((await syncRoom(host)).map((p) => p.id));
    assert.ok(ids.has(host.id) && ids.has(b.id) && ids.has(c.id) && ids.has(d.id));
    await disconnectAll([host, b, c, d]);
  });

  await runTest('27 six-player roster converges on every client', async () => {
    const host = await createHost('مضيف');
    const extras = await Promise.all(
      ['ب', 'ج', 'د', 'ه', 'و'].map((suffix) => joinPlayer(host.roomCode, `لاعب-${suffix}`)),
    );
    const all = [host, ...extras];
    await waitForRosterConvergence(all, 6, 'six');
    for (const client of all) {
      const players = await syncRoom(client);
      assert.equal(players.length, 6);
      assert.equal(players.filter((p) => p.isHost).length, 1);
      assert.equal(players.find((p) => p.isHost)?.id, host.id);
    }
    await disconnectAll(all);
  });

  await runTest('28 host disconnect keeps host identity until leave/expire', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await waitForRosterConvergence([host, b], 2, 'pair');

    await disconnectClient(host);
    await waitFor(
      async () => {
        const players = await syncRoom(b);
        const hostRow = players.find((p) => p.id === host.id);
        return hostRow?.status === 'DISCONNECTED' && hostRow.isHost ? true : null;
      },
      5000,
      'host disconnected still host',
      100,
    );

    const players = await syncRoom(b);
    assert.equal(players.find((p) => p.isHost)?.id, host.id);
    assert.equal(players.filter((p) => p.isHost).length, 1);
    await disconnectAll([b]);
  });

  await runTest('29 dual-tab same credential: newest wins, no duplicate', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await waitForRosterConvergence([host, b], 2, 'pair');

    const tab1 = b.socket;
    const tab2 = await connectClient();
    const tab2Client = emptyClient('لاعب-ب-tab2');
    tab2Client.socket = tab2;
    tab2Client.id = b.id;
    tab2Client.roomId = b.roomId;
    tab2Client.roomCode = b.roomCode;
    tab2Client.reconnectToken = b.reconnectToken;
    trackClientEvents(tab2Client);

    const recon = await ack<{ success: boolean }>(tab2, 'reconnect', {
      playerId: b.id,
      roomId: b.roomId,
      roomCode: b.roomCode,
      reconnectToken: b.reconnectToken,
    });
    assert.ok(recon.success, 'second tab reconnect succeeds');

    await waitFor(
      async () => {
        const players = await syncRoom(host);
        const matches = players.filter((p) => p.id === b.id);
        return matches.length === 1 && matches[0]?.status === 'CONNECTED' ? true : null;
      },
      5000,
      'single B connected',
      100,
    );

    // Old tab transport ends — must not mark B DISCONNECTED.
    tab1.disconnect();
    await sleep(400);

    const afterOldGone = await syncRoom(host);
    assert.equal(afterOldGone.filter((p) => p.id === b.id).length, 1);
    assert.equal(afterOldGone.find((p) => p.id === b.id)?.status, 'CONNECTED');

    await disconnectAll([host, tab2Client]);
  });

  await runTest('30 reconnect expired rejects and clears seat when alone', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await waitForRosterConvergence([host, b], 2, 'pair');

    await disconnectClient(b);

    const { prisma } = await import('../src/lib/prisma.js');
    await prisma.player.update({
      where: { id: b.id },
      data: { lastSeenAt: new Date(Date.now() - 4 * 60 * 1000) },
    });

    const socket = await connectClient();
    const expired = await ack<{
      success: boolean;
      error?: { code: string };
    }>(socket, 'reconnect', {
      playerId: b.id,
      roomId: b.roomId,
      roomCode: b.roomCode,
      reconnectToken: b.reconnectToken,
    });
    assert.equal(expired.success, false);
    assert.ok(
      expired.error?.code === 'RECONNECT_EXPIRED' || expired.error?.code === 'PLAYER_NOT_FOUND',
      `expired reconnect code: ${expired.error?.code}`,
    );

    await waitFor(
      async () => {
        const players = await syncRoom(host);
        return !players.some((p) => p.id === b.id) ? true : null;
      },
      5000,
      'expired B removed from active roster',
      100,
    );

    socket.disconnect();
    await disconnectAll([host]);
  });

  await runTest('31 lock metadata converges via room-updated', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await waitForRosterConvergence([host, b], 2, 'pair');

    let bLocked: boolean | null = null;
    b.socket.on('room-updated', (payload: { isLocked: boolean }) => {
      bLocked = payload.isLocked;
    });

    const lockRes = await ack<{ success: boolean; data?: { isLocked: boolean } }>(
      host.socket,
      'lock-room',
    );
    assert.ok(lockRes.success);
    assert.equal(lockRes.data?.isLocked, true);

    await waitFor(async () => (bLocked === true ? true : null), 5000, 'B sees lock', 50);

    const unlockRes = await ack<{ success: boolean; data?: { isLocked: boolean } }>(
      host.socket,
      'unlock-room',
    );
    assert.ok(unlockRes.success);
    assert.equal(unlockRes.data?.isLocked, false);
    await waitFor(async () => (bLocked === false ? true : null), 5000, 'B sees unlock', 50);

    await disconnectAll([host, b]);
  });

  await runTest('32 socket rebind via room-sync after listener reattach', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await waitForRosterConvergence([host, b], 2, 'pair');

    // Simulate provider remount: drop snapshot listeners, reattach once, sync.
    host.socket.removeAllListeners('room-players-snapshot');
    trackClientEvents(host);

    const c = await joinPlayer(host.roomCode, 'لاعب-ج');
    await waitFor(
      async () => (host.rosterPlayers.some((p) => p.id === c.id) ? true : null),
      5000,
      'host snapshot after reattach sees C',
      100,
    );

    const synced = await syncRoom(host);
    assert.equal(synced.length, 3);
    assert.ok(synced.some((p) => p.id === c.id));
    await waitForRosterConvergence([host, b, c], 3, 'post-remount');
    await disconnectAll([host, b, c]);
  });

  await runTest('33 reconnect within window: cleanup does not expire', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await waitForRosterConvergence([host, b], 2, 'pair');

    await disconnectClient(host);
    await waitFor(
      async () => {
        const players = await syncRoom(b);
        return players.find((p) => p.id === host.id)?.status === 'DISCONNECTED' ? true : null;
      },
      5000,
      'host disconnected',
      50,
    );
    await sleep(700);

    const duringWindow = await syncRoom(b);
    const hostRow = duringWindow.find((p) => p.id === host.id);
    assert.equal(hostRow?.status, 'DISCONNECTED');
    assert.equal(hostRow?.isHost, true);

    await reconnectClient(host);
    const restored = await syncRoom(host);
    assert.equal(restored.find((p) => p.id === host.id)?.status, 'CONNECTED');
    assert.equal(restored.find((p) => p.isHost)?.id, host.id);
    await disconnectAll([host, b]);
  });

  await runTest('34 abandoned host expires and new host can act', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await waitForRosterConvergence([host, b], 2, 'pair');

    await disconnectClient(host);
    await waitFor(
      async () => {
        const players = await syncRoom(b);
        return players.find((p) => p.id === host.id)?.status === 'DISCONNECTED' ? true : null;
      },
      5000,
      'host marked disconnected',
      50,
    );

    const { prisma } = await import('../src/lib/prisma.js');
    await prisma.player.update({
      where: { id: host.id },
      data: { lastSeenAt: new Date(Date.now() - 4 * 60 * 1000) },
    });

    await waitFor(
      async () => {
        const players = await syncRoom(b);
        const nextHost = players.find((p) => p.isHost);
        return nextHost?.id === b.id && !players.some((p) => p.id === host.id) ? true : null;
      },
      8000,
      'B becomes host after abandoned host expiry',
      100,
    );

    const lockRes = await ack<{ success: boolean; data?: { isLocked: boolean }; error?: { code: string } }>(
      b.socket,
      'lock-room',
    );
    assert.ok(lockRes.success, lockRes.error?.code ?? 'new host lock-room');
    assert.equal(lockRes.data?.isLocked, true);

    const left = await prisma.player.findUnique({ where: { id: host.id }, select: { status: true } });
    assert.equal(left?.status, 'LEFT');
    await disconnectAll([b]);
  });

  await runTest('35 disconnected guest expires and no longer counts active', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await waitForRosterConvergence([host, b], 2, 'pair');

    await disconnectClient(b);
    await waitFor(
      async () => {
        const players = await syncRoom(host);
        return players.find((p) => p.id === b.id)?.status === 'DISCONNECTED' ? true : null;
      },
      5000,
      'guest marked disconnected',
      50,
    );

    const { prisma } = await import('../src/lib/prisma.js');
    await prisma.player.update({
      where: { id: b.id },
      data: { lastSeenAt: new Date(Date.now() - 4 * 60 * 1000) },
    });

    await waitFor(
      async () => {
        const players = await syncRoom(host);
        return !players.some((p) => p.id === b.id) ? true : null;
      },
      8000,
      'expired guest removed from roster',
      100,
    );

    const activeCount = await prisma.player.count({
      where: {
        roomId: host.roomId,
        status: { in: ['CONNECTED', 'DISCONNECTED'] },
      },
    });
    assert.equal(activeCount, 1);
    assert.equal((await syncRoom(host)).find((p) => p.isHost)?.id, host.id);
    await disconnectAll([host]);
  });

  await runTest('36 all disconnected players expire and room is deleted', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await waitForRosterConvergence([host, b], 2, 'pair');
    const roomId = host.roomId;
    const { prisma } = await import('../src/lib/prisma.js');

    await disconnectClient(host);
    await disconnectClient(b);
    await waitFor(
      async () => {
        const disconnected = await prisma.player.count({
          where: { roomId, status: 'DISCONNECTED' },
        });
        return disconnected === 2 ? true : null;
      },
      5000,
      'both players disconnected',
      50,
    );

    const roomBefore = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true } });
    assert.ok(roomBefore);

    await prisma.player.updateMany({
      where: { roomId, status: 'DISCONNECTED' },
      data: { lastSeenAt: new Date(Date.now() - 4 * 60 * 1000) },
    });

    await waitFor(
      async () => {
        const room = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true } });
        return room === null ? true : null;
      },
      8000,
      'abandoned room deleted after expiry',
      100,
    );
  });

  await runTest('37 reconnect wins against stale expiry mutation', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await waitForRosterConvergence([host, b], 2, 'pair');

    await disconnectClient(b);
    await reconnectClient(b);

    const { expireDisconnectedPlayer } = await import(
      '../src/modules/room/services/disconnected-player-expiry.service.js'
    );
    const expired = await expireDisconnectedPlayer(b.id, b.roomId);
    assert.equal(expired, null);

    const players = await syncRoom(host);
    assert.equal(players.find((p) => p.id === b.id)?.status, 'CONNECTED');
    await disconnectAll([host, b]);
  });

  await runTest('38 overlapping expiry is idempotent', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await waitForRosterConvergence([host, b], 2, 'pair');

    await disconnectClient(b);
    await waitFor(
      async () => {
        const players = await syncRoom(host);
        return players.find((p) => p.id === b.id)?.status === 'DISCONNECTED' ? true : null;
      },
      5000,
      'guest marked disconnected before expiry',
      50,
    );
    const { prisma } = await import('../src/lib/prisma.js');
    await prisma.player.update({
      where: { id: b.id },
      data: { lastSeenAt: new Date(Date.now() - 4 * 60 * 1000) },
    });

    await waitFor(
      async () => {
        const players = await syncRoom(host);
        return !players.some((p) => p.id === b.id) ? true : null;
      },
      8000,
      'guest expired once',
      100,
    );

    const { expireDisconnectedPlayer } = await import(
      '../src/modules/room/services/disconnected-player-expiry.service.js'
    );
    const second = await expireDisconnectedPlayer(b.id, b.roomId);
    assert.equal(second, null);

    await sleep(500);
    const players = await syncRoom(host);
    assert.equal(players.filter((p) => p.isHost).length, 1);
    assert.equal(players.find((p) => p.isHost)?.id, host.id);
    assert.equal(players.length, 1);
    await disconnectAll([host]);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('room-lifecycle suite crashed:', error);
  process.exit(1);
});
