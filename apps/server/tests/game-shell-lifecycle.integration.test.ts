/**
 * P3 Game Shell lifecycle hardening — multi-game, duplicate end, stale events.
 * Requires server on :4001 with WANASATNA_TEST_MODE=1.
 *
 * Run: pnpm exec tsx tests/game-shell-lifecycle.integration.test.ts
 */
import assert from 'node:assert/strict';
import {
  BARA_AL_SALAFA_GAME_ID,
  BARA_AL_SALAFA_SYNC_EVENT,
  DRAW_GUESS_GAME_ID,
  DRAW_GUESS_STROKE_EVENT,
  DRAW_GUESS_SYNC_EVENT,
  GAME_SHELL_END_EVENT,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
  GAME_SHELL_SYNC_EVENT,
  GUESSING_CHALLENGE_GAME_ID,
  GUESSING_CHALLENGE_SYNC_EVENT,
  TEAM_CONFIGURE_EVENT,
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

async function createLobby(count: number): Promise<TestClient[]> {
  const names = ['مضيف', 'لاعب-ب', 'لاعب-ج', 'لاعب-د'].slice(0, count);
  const clients: TestClient[] = [];

  for (let i = 0; i < names.length; i += 1) {
    const client = emptyClient(names[i]!);
    client.socket = await connectClient();
    trackClientEvents(client);
    clients.push(client);
  }

  const [host, ...rest] = clients as [TestClient, ...TestClient[]];
  const createRes = await ack<{
    success: boolean;
    data: { room: { code: string; id: string }; player: { id: string } };
  }>(host.socket, 'create-room', { playerName: host.name });
  assert.ok(createRes.success);
  host.id = createRes.data.player.id;
  host.roomId = createRes.data.room.id;
  host.roomCode = createRes.data.room.code;

  for (const joiner of rest) {
    const joinRes = await ack<{
      success: boolean;
      data: { player: { id: string }; room: { id: string } };
    }>(joiner.socket, 'join-room', { roomCode: host.roomCode, playerName: joiner.name });
    assert.ok(joinRes.success);
    joiner.id = joinRes.data.player.id;
    joiner.roomId = joinRes.data.room.id;
    joiner.roomCode = host.roomCode;
  }

  return clients;
}

async function startGame(
  host: TestClient,
  clients: TestClient[],
  gameId: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  for (const client of clients) {
    client.shellEvents.length = 0;
    client.navigations.length = 0;
  }

  const startRes = await ack<{
    success: boolean;
    data?: { state: { shellId: string; phase: string; gameId: string | null } };
    error?: { code: string; message: string };
  }>(host.socket, GAME_SHELL_START_FROM_LOBBY_EVENT, { gameId, ...extra });

  assert.ok(startRes.success, `start ${gameId}: ${startRes.error?.code} ${startRes.error?.message}`);
  const shellId = startRes.data!.state.shellId;

  await waitFor(
    async () =>
      clients.every((c) => c.shellEvents.some((e) => e.phase === 'PLAYING')) ? true : null,
    15000,
    `${gameId} PLAYING`,
    50,
  );

  return shellId;
}

async function hostEnd(host: TestClient): Promise<{ success: boolean; error?: { code: string } }> {
  return ack(host.socket, GAME_SHELL_END_EVENT, {});
}

async function pluginSyncOk(socket: TestClient['socket'], event: string): Promise<boolean> {
  const res = await ack<{ success: boolean }>(socket, event, {});
  return res.success === true;
}

async function main(): Promise<void> {
  await waitForServer();

  await runTest('SCENARIO A: Draw Guess → End → Bara AlSalafa', async () => {
    const clients = await createLobby(3);
    const [host] = clients;
    const shellA = await startGame(host, clients, DRAW_GUESS_GAME_ID);
    assert.equal(await pluginSyncOk(host.socket, DRAW_GUESS_SYNC_EVENT), true);

    const ended = await hostEnd(host);
    assert.ok(ended.success);
    assert.equal(await pluginSyncOk(host.socket, DRAW_GUESS_SYNC_EVENT), false);

    await waitFor(
      async () => {
        const sync = await ack<{ success: boolean; data: { state: null | { shellId: string } } }>(
          host.socket,
          GAME_SHELL_SYNC_EVENT,
        );
        return sync.success && sync.data.state === null ? true : null;
      },
      5000,
      'shell cleared after end',
      50,
    );

    const shellB = await startGame(host, clients, BARA_AL_SALAFA_GAME_ID);
    assert.notEqual(shellA, shellB);
    assert.equal(await pluginSyncOk(host.socket, BARA_AL_SALAFA_SYNC_EVENT), true);
    assert.equal(await pluginSyncOk(host.socket, DRAW_GUESS_SYNC_EVENT), false);

    await hostEnd(host);
    for (const client of clients) client.socket.disconnect();
  });

  await runTest('SCENARIO B: same game rematch gets new shellId', async () => {
    const clients = await createLobby(3);
    const [host] = clients;
    const first = await startGame(host, clients, DRAW_GUESS_GAME_ID);
    await hostEnd(host);
    const second = await startGame(host, clients, DRAW_GUESS_GAME_ID);
    assert.notEqual(first, second);
    await hostEnd(host);
    for (const client of clients) client.socket.disconnect();
  });

  await runTest('SCENARIO F: duplicate End Game is harmless', async () => {
    const clients = await createLobby(3);
    const [host] = clients;
    await startGame(host, clients, DRAW_GUESS_GAME_ID);
    const first = await hostEnd(host);
    assert.ok(first.success);
    const second = await hostEnd(host);
    assert.equal(second.success, false);
    assert.equal(second.error?.code, 'SHELL_NOT_FOUND');
    for (const client of clients) client.socket.disconnect();
  });

  await runTest('non-host End Game rejected', async () => {
    const clients = await createLobby(3);
    const [host, b] = clients;
    await startGame(host, clients, DRAW_GUESS_GAME_ID);
    const denied = await ack<{ success: boolean; error?: { code: string } }>(
      b.socket,
      GAME_SHELL_END_EVENT,
      {},
    );
    assert.equal(denied.success, false);
    assert.equal(denied.error?.code, 'NOT_HOST');
    assert.equal(await pluginSyncOk(host.socket, DRAW_GUESS_SYNC_EVENT), true);
    await hostEnd(host);
    for (const client of clients) client.socket.disconnect();
  });

  await runTest('stale Draw Guess stroke after End does not revive match', async () => {
    const clients = await createLobby(3);
    const [host] = clients;
    await startGame(host, clients, DRAW_GUESS_GAME_ID);
    await hostEnd(host);

    const stroke = await ack<{ success: boolean; error?: { code: string } }>(
      host.socket,
      DRAW_GUESS_STROKE_EVENT,
      { points: [{ x: 1, y: 1 }] },
    );
    assert.equal(stroke.success, false);
    assert.equal(await pluginSyncOk(host.socket, DRAW_GUESS_SYNC_EVENT), false);

    for (const client of clients) client.socket.disconnect();
  });

  await runTest('GC abort clears match; teams persist; rematch works', async () => {
    const clients = await createLobby(2);
    const [host] = clients;
    await ack(host.socket, TEAM_CONFIGURE_EVENT, {
      gameId: GUESSING_CHALLENGE_GAME_ID,
      mode: '1v1',
    });
    await startGame(host, clients, GUESSING_CHALLENGE_GAME_ID, {
      categoryId: 'football',
      guessingChallenge: { mode: '1v1' },
    });
    assert.equal(await pluginSyncOk(host.socket, GUESSING_CHALLENGE_SYNC_EVENT), true);

    await hostEnd(host);
    assert.equal(await pluginSyncOk(host.socket, GUESSING_CHALLENGE_SYNC_EVENT), false);

    const teamSync = await ack<{ success: boolean; data: { snapshot: PregameTeamSnapshot | null } }>(
      host.socket,
      TEAM_SYNC_EVENT,
    );
    assert.ok(teamSync.success);
    assert.ok(teamSync.data.snapshot);
    assert.equal(teamSync.data.snapshot?.assignments.length, 2);

    // Second match starts cleanly with mode in payload (room mode cleared on abort).
    await startGame(host, clients, GUESSING_CHALLENGE_GAME_ID, {
      categoryId: 'football',
      guessingChallenge: { mode: '1v1' },
    });
    assert.equal(await pluginSyncOk(host.socket, GUESSING_CHALLENGE_SYNC_EVENT), true);
    await hostEnd(host);

    for (const client of clients) client.socket.disconnect();
  });

  await runTest('SCENARIO D: waiting player joins mid-match; game stays stable', async () => {
    const clients = await createLobby(3);
    const [host] = clients;
    await startGame(host, clients, DRAW_GUESS_GAME_ID);

    const waiter = emptyClient('منتظر');
    waiter.socket = await connectClient();
    trackClientEvents(waiter);
    const joinRes = await ack<{
      success: boolean;
      data: { player: { id: string } };
    }>(waiter.socket, 'join-room', { roomCode: host.roomCode, playerName: waiter.name });
    assert.ok(joinRes.success);
    waiter.id = joinRes.data.player.id;

    const shell = await ack<{
      success: boolean;
      data: { state: { matchParticipantIds: string[] | null; phase: string } | null };
    }>(host.socket, GAME_SHELL_SYNC_EVENT);
    assert.ok(shell.success);
    assert.equal(shell.data.state?.phase, 'PLAYING');
    assert.ok(shell.data.state?.matchParticipantIds);
    assert.ok(!shell.data.state!.matchParticipantIds!.includes(waiter.id));

    // Waiting player plugin sync must not grant a participant view that mutates match.
    const waiterSync = await ack<{ success: boolean }>(waiter.socket, DRAW_GUESS_SYNC_EVENT, {});
    assert.equal(waiterSync.success, false);

    await hostEnd(host);
    waiter.socket.disconnect();
    for (const client of clients) client.socket.disconnect();
  });

  await runTest('duplicate start while active rejected', async () => {
    const clients = await createLobby(3);
    const [host] = clients;
    await startGame(host, clients, DRAW_GUESS_GAME_ID);
    const dup = await ack<{ success: boolean; error?: { code: string } }>(
      host.socket,
      GAME_SHELL_START_FROM_LOBBY_EVENT,
      { gameId: BARA_AL_SALAFA_GAME_ID },
    );
    assert.equal(dup.success, false);
    assert.equal(dup.error?.code, 'SHELL_ALREADY_EXISTS');
    assert.equal(await pluginSyncOk(host.socket, DRAW_GUESS_SYNC_EVENT), true);
    assert.equal(await pluginSyncOk(host.socket, BARA_AL_SALAFA_SYNC_EVENT), false);
    await hostEnd(host);
    for (const client of clients) client.socket.disconnect();
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
