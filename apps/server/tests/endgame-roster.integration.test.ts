/**
 * P3 blocker regression: End Game must preserve Room membership symmetrically.
 * Simulates Lobby remount via room-sync (sync-first path) after abort.
 */
import assert from 'node:assert/strict';
import {
  BARA_AL_SALAFA_GAME_ID,
  DRAW_GUESS_GAME_ID,
  GAME_SHELL_END_EVENT,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
  JOIN_ROOM_EVENT,
  RECONNECT_EVENT,
  ROOM_SYNC_EVENT,
} from '@wanasatna/shared';
import {
  ack,
  connectClient,
  trackClientEvents,
  waitFor,
  waitForServer,
  type TestClient,
  type RosterPlayer,
} from './helpers/socket-utils.js';

function emptyClient(name: string): TestClient {
  return {
    name,
    socket: null as unknown as TestClient['socket'],
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
  return players
    .map((p) => p.id)
    .sort()
    .join(',');
}

async function createHost(name: string): Promise<TestClient> {
  const host = emptyClient(name);
  host.socket = await connectClient();
  trackClientEvents(host);
  const res = await ack<{
    success: boolean;
    data: {
      room: { id: string; code: string };
      player: { id: string };
      reconnectToken?: string;
      players: RosterPlayer[];
    };
  }>(host.socket, 'create-room', { playerName: name });
  assert.ok(res.success);
  host.id = res.data.player.id;
  host.roomId = res.data.room.id;
  host.roomCode = res.data.room.code;
  host.reconnectToken = res.data.reconnectToken ?? '';
  host.rosterPlayers = res.data.players;
  return host;
}

async function joinPlayer(roomCode: string, name: string): Promise<TestClient> {
  const client = emptyClient(name);
  client.socket = await connectClient();
  trackClientEvents(client);
  const res = await ack<{
    success: boolean;
    data: {
      room: { id: string };
      player: { id: string };
      reconnectToken?: string;
      players: RosterPlayer[];
    };
  }>(client.socket, JOIN_ROOM_EVENT, { roomCode, playerName: name });
  assert.ok(res.success, `join ${name}`);
  client.id = res.data.player.id;
  client.roomId = res.data.room.id;
  client.roomCode = roomCode;
  client.reconnectToken = res.data.reconnectToken ?? '';
  client.rosterPlayers = res.data.players;
  return client;
}

async function startPlaying(
  host: TestClient,
  clients: TestClient[],
  gameId: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  for (const client of clients) {
    client.shellEvents.length = 0;
  }

  const start = await ack<{ success: boolean; error?: { code: string } }>(
    host.socket,
    GAME_SHELL_START_FROM_LOBBY_EVENT,
    { gameId, ...extra },
  );
  assert.ok(start.success, `start ${gameId}: ${start.error?.code ?? ''}`);

  await waitFor(
    async () =>
      clients.every((client) => client.shellEvents.some((event) => event.phase === 'PLAYING'))
        ? true
        : null,
    15000,
    'PLAYING',
  );
}

async function endAndRemountSync(clients: TestClient[]): Promise<void> {
  const host = clients[0]!;
  const ended = await ack<{ success: boolean }>(host.socket, GAME_SHELL_END_EVENT, {});
  assert.ok(ended.success);

  await waitFor(
    async () => (clients.every((client) => client.navigations.includes('/lobby')) ? true : null),
    5000,
    'navigate lobby',
  );

  // Simulate Lobby remount sync-first path (bound room-sync), then reconnect fallback.
  for (const client of clients) {
    client.socket.removeAllListeners('room-players-snapshot');
    trackClientEvents(client);

    const sync = await ack<{
      success: boolean;
      data?: { players: RosterPlayer[] };
      error?: { code: string };
    }>(client.socket, ROOM_SYNC_EVENT, {});

    if (sync.success && sync.data) {
      client.rosterPlayers = sync.data.players;
      continue;
    }

    const reconnect = await ack<{
      success: boolean;
      data?: { players: RosterPlayer[] };
      error?: { code: string };
    }>(client.socket, RECONNECT_EVENT, {
      playerId: client.id,
      roomId: client.roomId,
      roomCode: client.roomCode,
      reconnectToken: client.reconnectToken,
    });
    assert.ok(reconnect.success, `${client.name} remount reconnect: ${reconnect.error?.code}`);
    client.rosterPlayers = reconnect.data!.players;
  }
}

function assertSymmetricRoster(clients: TestClient[], expectedCount: number, label: string): void {
  for (const client of clients) {
    assert.equal(
      client.rosterPlayers.length,
      expectedCount,
      `${label}: ${client.name} count`,
    );
    assert.ok(
      client.rosterPlayers.every((player) => player.status === 'CONNECTED'),
      `${label}: ${client.name} all CONNECTED`,
    );
  }

  const key = rosterKey(clients[0]!.rosterPlayers);
  for (const client of clients.slice(1)) {
    assert.equal(rosterKey(client.rosterPlayers), key, `${label}: ${client.name} ids`);
  }
}

async function disconnectAll(clients: TestClient[]): Promise<void> {
  for (const client of clients) {
    client.socket.disconnect();
  }
}

async function main() {
  await waitForServer();
  let passed = 0;

  async function run(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`, error);
      process.exitCode = 1;
    }
  }

  await run('1 basic 2-client End Game → symmetric {A,B}', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await startPlaying(host, [host, b], DRAW_GUESS_GAME_ID);
    await endAndRemountSync([host, b]);
    assertSymmetricRoster([host, b], 2, 'basic');
    await disconnectAll([host, b]);
  });

  await run('2 End Game + immediate dual sync does not shrink', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await startPlaying(host, [host, b], DRAW_GUESS_GAME_ID);
    await endAndRemountSync([host, b]);

    const [hostSync, bSync] = await Promise.all([
      ack<{ success: boolean; data: { players: RosterPlayer[] } }>(host.socket, ROOM_SYNC_EVENT, {}),
      ack<{ success: boolean; data: { players: RosterPlayer[] } }>(b.socket, ROOM_SYNC_EVENT, {}),
    ]);
    assert.ok(hostSync.success && bSync.success);
    host.rosterPlayers = hostSync.data.players;
    b.rosterPlayers = bSync.data.players;
    assertSymmetricRoster([host, b], 2, 'dual-sync');
    await disconnectAll([host, b]);
  });

  await run('3 waiting player C appears after End Game', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await startPlaying(host, [host, b], DRAW_GUESS_GAME_ID);

    const c = await joinPlayer(host.roomCode, 'لاعب-ج');
    await waitFor(
      async () => (host.rosterPlayers.some((player) => player.id === c.id) ? true : null),
      5000,
      'host sees waiting C',
    );

    await endAndRemountSync([host, b, c]);
    assertSymmetricRoster([host, b, c], 3, 'waiting-c');
    await disconnectAll([host, b, c]);
  });

  await run('4 second game starts after End Game', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await startPlaying(host, [host, b], DRAW_GUESS_GAME_ID);
    await endAndRemountSync([host, b]);
    assertSymmetricRoster([host, b], 2, 'pre-second');
    await startPlaying(host, [host, b], DRAW_GUESS_GAME_ID);
    await disconnectAll([host, b]);
  });

  await run('5 different game after End Game', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    const c = await joinPlayer(host.roomCode, 'لاعب-ج');
    await startPlaying(host, [host, b, c], DRAW_GUESS_GAME_ID);
    await endAndRemountSync([host, b, c]);
    assertSymmetricRoster([host, b, c], 3, 'pre-diff');
    await startPlaying(host, [host, b, c], BARA_AL_SALAFA_GAME_ID, { categoryId: 'football' });
    await disconnectAll([host, b, c]);
  });

  await run('6 same-game rematch', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    await startPlaying(host, [host, b], DRAW_GUESS_GAME_ID);
    await endAndRemountSync([host, b]);
    assertSymmetricRoster([host, b], 2, 'pre-rematch');
    await startPlaying(host, [host, b], DRAW_GUESS_GAME_ID);
    await endAndRemountSync([host, b]);
    assertSymmetricRoster([host, b], 2, 'post-rematch');
    await disconnectAll([host, b]);
  });

  await run('7 four players converge after End Game + second start', async () => {
    const host = await createHost('مضيف');
    const b = await joinPlayer(host.roomCode, 'لاعب-ب');
    const c = await joinPlayer(host.roomCode, 'لاعب-ج');
    const d = await joinPlayer(host.roomCode, 'لاعب-د');
    const clients = [host, b, c, d];
    await startPlaying(host, clients, DRAW_GUESS_GAME_ID);
    await endAndRemountSync(clients);
    assertSymmetricRoster(clients, 4, 'four');
    await startPlaying(host, clients, DRAW_GUESS_GAME_ID);
    await disconnectAll(clients);
  });

  console.log(`\n${passed}/7 endgame-roster regressions passed`);
  if (passed < 7) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
