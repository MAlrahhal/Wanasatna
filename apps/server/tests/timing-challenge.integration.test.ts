/**
 * Timing Challenge Socket.IO multiplayer (P4.4).
 * Requires server on localhost:4001 with WANASATNA_TEST_MODE=1.
 *
 * Run: pnpm --filter @wanasatna/server test:timing-challenge:integration
 */
import assert from 'node:assert/strict';
import type { TimingChallengePlayerView } from '@wanasatna/shared';
import {
  TIMING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
  TIMING_CHALLENGE_GAME_ID,
  TIMING_CHALLENGE_READY_EVENT,
  TIMING_CHALLENGE_START_TIMER_EVENT,
  TIMING_CHALLENGE_STOP_TIMER_EVENT,
  TIMING_CHALLENGE_SUBMIT_GUESS_EVENT,
  TIMING_CHALLENGE_SYNC_EVENT,
} from '@wanasatna/shared';
import {
  PLAYER_NAMES,
  ack,
  connectClient,
  sleep,
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

async function syncView(socket: TestClient['socket']): Promise<TimingChallengePlayerView> {
  const res = await ack<{
    success: boolean;
    data?: { view: TimingChallengePlayerView };
    error?: { code: string; message: string };
  }>(socket, TIMING_CHALLENGE_SYNC_EVENT, {});
  if (!res.success || !res.data?.view) {
    throw new Error(
      `timing sync failed: ${res.error?.code ?? 'UNKNOWN'} ${res.error?.message ?? ''}`,
    );
  }
  return res.data.view;
}

async function createRoomWithPlayers(playerCount: number): Promise<TestClient[]> {
  assert.ok(playerCount >= 2 && playerCount <= 8);
  const names = PLAYER_NAMES.slice(0, playerCount);
  const clients: TestClient[] = [];

  const hostSocket = await connectClient();
  const host: TestClient = {
    name: names[0]!,
    socket: hostSocket,
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
  trackClientEvents(host);
  clients.push(host);

  const createRes = await ack<{
    success: boolean;
    data: { room: { code: string; id: string }; player: { id: string }; reconnectToken?: string };
  }>(host.socket, 'create-room', { playerName: host.name });
  assert.ok(createRes.success, 'create-room');
  host.id = createRes.data.player.id;
  host.roomId = createRes.data.room.id;
  host.roomCode = createRes.data.room.code;
  host.reconnectToken = createRes.data.reconnectToken ?? '';

  for (const name of names.slice(1)) {
    const socket = await connectClient();
    const client: TestClient = {
      name,
      socket,
      id: '',
      roomId: '',
      roomCode: host.roomCode,
      reconnectToken: '',
      shellEvents: [],
      roster: [],
      rosterPlayers: [],
      navigations: [],
      recoveryEvents: [],
    };
    trackClientEvents(client);
    const joinRes = await ack<{
      success: boolean;
      data: { player: { id: string }; room: { id: string }; reconnectToken?: string };
    }>(client.socket, 'join-room', { roomCode: host.roomCode, playerName: name });
    assert.ok(joinRes.success, `${name} joins`);
    client.id = joinRes.data.player.id;
    client.roomId = joinRes.data.room.id;
    client.reconnectToken = joinRes.data.reconnectToken ?? '';
    clients.push(client);
  }

  await waitFor(
    async () =>
      clients.every((client) => client.roster.length === playerCount) ? true : null,
    10000,
    'roster sync',
    200,
  );

  return clients;
}

async function startTiming(
  clients: TestClient[],
  mode: 'guess-time' | 'stop-timer',
): Promise<TimingChallengePlayerView> {
  const host = clients[0]!;
  const startRes = await ack<{ success: boolean; error?: { message?: string } }>(
    host.socket,
    'game-shell-start-from-lobby',
    {
      gameId: TIMING_CHALLENGE_GAME_ID,
      timingChallenge: { mode, minSeconds: 3, maxSeconds: 5 },
    },
  );
  assert.ok(startRes.success, startRes.error?.message ?? 'start failed');

  await waitFor(
    async () =>
      clients.every((client) => client.shellEvents.some((event) => event.phase === 'PLAYING'))
        ? true
        : null,
    15000,
    'PLAYING',
    200,
  );

  return waitFor(async () => {
    const view = await syncView(host.socket);
    return view.gamePhase === 'ready' ? view : null;
  }, 10000, 'ready');
}

async function disconnectAll(clients: TestClient[]): Promise<void> {
  for (const client of clients) {
    client.socket.disconnect();
  }
  await sleep(50);
}

async function readyAll(clients: TestClient[], roundId: string): Promise<void> {
  for (const client of clients) {
    const res = await ack<{ success: boolean; error?: { message?: string } }>(
      client.socket,
      TIMING_CHALLENGE_READY_EVENT,
      { roundId },
    );
    assert.ok(res.success, res.error?.message ?? 'ready');
  }
}

async function playGuessRound(clients: TestClient[], roundId: string): Promise<void> {
  const host = clients[0]!;
  await readyAll(clients, roundId);

  await waitFor(async () => {
    const view = await syncView(host.socket);
    return view.gamePhase === 'guessing' ? view : null;
  }, 20000, 'guessing');

  const view = await syncView(host.socket);
  assert.equal(view.targetMs, null);

  const stale = await ack<{ success: boolean }>(host.socket, TIMING_CHALLENGE_SUBMIT_GUESS_EVENT, {
    roundId: '00000000-0000-0000-0000-000000000000',
    guessSeconds: 4,
  });
  assert.equal(stale.success, false, 'stale guess rejected');

  for (const client of clients) {
    const clientView = await syncView(client.socket);
    const res = await ack<{ success: boolean; error?: { message?: string } }>(
      client.socket,
      TIMING_CHALLENGE_SUBMIT_GUESS_EVENT,
      { roundId: clientView.roundId, guessSeconds: 4 },
    );
    assert.ok(res.success, res.error?.message ?? 'guess');
  }

  await waitFor(async () => {
    const results = await syncView(host.socket);
    return results.gamePhase === 'round-results' ? results : null;
  }, 10000, 'round results');

  const results = await syncView(host.socket);
  assert.ok(results.targetMs !== null);
}

async function playStopRound(clients: TestClient[], roundId: string): Promise<void> {
  const host = clients[0]!;
  await readyAll(clients, roundId);

  await waitFor(async () => {
    const view = await syncView(host.socket);
    return view.gamePhase === 'stop-timer' ? view : null;
  }, 10000, 'stop-timer');

  for (const client of clients) {
    const view = await syncView(client.socket);
    assert.ok(view.targetMs !== null);
    const start = await ack<{ success: boolean }>(client.socket, TIMING_CHALLENGE_START_TIMER_EVENT, {
      roundId: view.roundId,
    });
    assert.ok(start.success);
    await sleep(30);
    const stop = await ack<{ success: boolean }>(client.socket, TIMING_CHALLENGE_STOP_TIMER_EVENT, {
      roundId: view.roundId,
    });
    assert.ok(stop.success);
  }

  await waitFor(async () => {
    const results = await syncView(host.socket);
    return results.gamePhase === 'round-results' ? results : null;
  }, 10000, 'stop results');
}

async function finishMatchToLobby(clients: TestClient[]): Promise<void> {
  const host = clients[0]!;

  for (let round = 1; round <= 3; round += 1) {
    await waitFor(async () => {
      const view = await syncView(host.socket);
      return view.gamePhase === 'round-results' && view.currentRound === round ? view : null;
    }, 20000, `results r${round}`);

    const cont = await ack<{
      success: boolean;
      data?: { view?: TimingChallengePlayerView };
      error?: { message?: string };
    }>(host.socket, TIMING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT, {});
    assert.ok(cont.success, cont.error?.message ?? 'continue');
  }

  await waitFor(async () => {
    const view = await syncView(host.socket);
    return view.gamePhase === 'match-completed' ? view : null;
  }, 10000, 'match-completed');

  const lobby = await ack<{ success: boolean; error?: { message?: string } }>(
    host.socket,
    TIMING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
    {},
  );
  assert.ok(lobby.success, lobby.error?.message ?? 'lobby');

  await waitFor(
    async () => (host.navigations.includes('/lobby') ? true : null),
    10000,
    'nav lobby',
    200,
  );
}

async function runGuessMatch(playerCount: number): Promise<void> {
  const clients = await createRoomWithPlayers(playerCount);
  try {
    const first = await startTiming(clients, 'guess-time');
    assert.equal(first.totalRounds, 3);
    assert.equal(first.mode, 'guess-time');

    for (let round = 1; round <= 3; round += 1) {
      const readyView =
        round === 1
          ? first
          : await waitFor(async () => {
              const view = await syncView(clients[0]!.socket);
              return view.gamePhase === 'ready' && view.currentRound === round ? view : null;
            }, 20000, `ready r${round}`);
      await playGuessRound(clients, readyView.roundId);
      if (round < 3) {
        await ack(clients[0]!.socket, TIMING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT, {});
      } else {
        await ack(clients[0]!.socket, TIMING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT, {});
        await waitFor(async () => {
          const view = await syncView(clients[0]!.socket);
          return view.gamePhase === 'match-completed' ? view : null;
        }, 10000, 'final');
        await ack(clients[0]!.socket, TIMING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT, {});
        await waitFor(
          async () => (clients[0]!.navigations.includes('/lobby') ? true : null),
          10000,
          'lobby',
          200,
        );
      }
    }

    const restart = await ack<{ success: boolean; error?: { message?: string } }>(
      clients[0]!.socket,
      'game-shell-start-from-lobby',
      {
        gameId: TIMING_CHALLENGE_GAME_ID,
        timingChallenge: { mode: 'stop-timer', minSeconds: 3, maxSeconds: 5 },
      },
    );
    assert.ok(restart.success, restart.error?.message ?? 'A→Lobby→B');
  } finally {
    await disconnectAll(clients);
  }
}

async function runStopMatch(playerCount: number): Promise<void> {
  const clients = await createRoomWithPlayers(playerCount);
  try {
    const first = await startTiming(clients, 'stop-timer');
    for (let round = 1; round <= 3; round += 1) {
      const readyView =
        round === 1
          ? first
          : await waitFor(async () => {
              const view = await syncView(clients[0]!.socket);
              return view.gamePhase === 'ready' && view.currentRound === round ? view : null;
            }, 20000, `stop ready r${round}`);
      await playStopRound(clients, readyView.roundId);
      await ack(clients[0]!.socket, TIMING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT, {});
    }
    await waitFor(async () => {
      const view = await syncView(clients[0]!.socket);
      return view.gamePhase === 'match-completed' ? view : null;
    }, 10000, 'stop final');
    await ack(clients[0]!.socket, TIMING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT, {});
    await waitFor(
      async () => (clients[0]!.navigations.includes('/lobby') ? true : null),
      10000,
      'stop lobby',
      200,
    );
  } finally {
    await disconnectAll(clients);
  }
}

async function main(): Promise<void> {
  console.log('[timing-challenge] waiting for test server...');
  await waitForServer();

  await runTest('2p guess-time full + shell cleanup', async () => {
    await runGuessMatch(2);
  });

  await runTest('2p stop-timer full', async () => {
    await runStopMatch(2);
  });

  await runTest('8p guess-time full', async () => {
    await runGuessMatch(8);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

void main();
