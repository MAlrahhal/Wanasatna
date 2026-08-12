/**
 * Cross-game shell cleanup: Final Results → Lobby must delete Game Shell.
 */
import assert from 'node:assert/strict';
import type { DrawGuessPlayerView } from '@wanasatna/shared';
import {
  BARA_AL_SALAFA_ADVANCE_DIRECTED_QUESTION_EVENT,
  BARA_AL_SALAFA_CONTINUE_ROUND_RESULTS_EVENT,
  BARA_AL_SALAFA_GAME_ID,
  BARA_AL_SALAFA_SKIP_FREE_QUESTION_TURN_EVENT,
  BARA_AL_SALAFA_SUBMIT_IMPOSTOR_GUESS_EVENT,
  BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT,
  BARA_AL_SALAFA_SUBMIT_VOTE_EVENT,
  DRAW_GUESS_CONTINUE_ROUND_RESULTS_EVENT,
  DRAW_GUESS_GAME_ID,
  DRAW_GUESS_SUBMIT_GUESS_EVENT,
  DRAW_GUESS_SYNC_EVENT,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
  GAME_SHELL_SYNC_EVENT,
} from '@wanasatna/shared';
import {
  PLAYER_NAMES,
  ack,
  connectClient,
  sleep,
  syncView,
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

async function assertNoShell(host: TestClient, label: string): Promise<void> {
  const sync = await ack<{
    success: boolean;
    data: { state: { phase: string; shellId: string } | null };
  }>(host.socket, GAME_SHELL_SYNC_EVENT, {});
  assert.equal(sync.data.state, null, `${label}: shell must be deleted`);
}

async function createTrio(): Promise<TestClient[]> {
  const names = PLAYER_NAMES.slice(0, 3);
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
  const createRes = await ack<{
    success: boolean;
    data: { room: { code: string; id: string }; player: { id: string }; reconnectToken?: string };
  }>(host.socket, 'create-room', { playerName: host.name });
  assert.ok(createRes.success);
  host.id = createRes.data.player.id;
  host.roomId = createRes.data.room.id;
  host.roomCode = createRes.data.room.code;
  host.reconnectToken = createRes.data.reconnectToken ?? '';

  const clients: TestClient[] = [host];
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
    assert.ok(joinRes.success);
    client.id = joinRes.data.player.id;
    client.roomId = joinRes.data.room.id;
    client.reconnectToken = joinRes.data.reconnectToken ?? '';
    clients.push(client);
  }
  return clients;
}

async function startGame(host: TestClient, clients: TestClient[], gameId: string): Promise<void> {
  for (const c of clients) {
    c.shellEvents.length = 0;
    c.navigations.length = 0;
  }
  const startRes = await ack<{ success: boolean; error?: { message?: string } }>(
    host.socket,
    GAME_SHELL_START_FROM_LOBBY_EVENT,
    gameId === DRAW_GUESS_GAME_ID
      ? { gameId, drawGuess: { drawerMode: 'random' } }
      : { gameId },
  );
  assert.ok(startRes.success, startRes.error?.message ?? `start ${gameId}`);
  await waitFor(
    async () =>
      clients.every((c) => c.shellEvents.some((e) => e.phase === 'PLAYING')) ? true : null,
    15000,
    `${gameId} PLAYING`,
    200,
  );
}

async function syncDraw(socket: TestClient['socket']): Promise<DrawGuessPlayerView> {
  const res = await ack<{
    success: boolean;
    data?: { view: DrawGuessPlayerView };
    error?: { message?: string };
  }>(socket, DRAW_GUESS_SYNC_EVENT, {});
  if (!res.success || !res.data?.view) {
    throw new Error(res.error?.message ?? 'draw sync failed');
  }
  return res.data.view;
}

async function finishBaraToMatchCompleted(clients: TestClient[]): Promise<void> {
  const host = clients[0]!;
  const byId = Object.fromEntries(clients.map((c) => [c.id, c]));

  await waitFor(async () => {
    const v = await syncView(host.socket);
    return v.gamePhase === 'description' ? v : null;
  }, 15000, 'description');

  for (const c of clients) {
    await ack(c.socket, BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT, {});
  }

  await waitFor(async () => {
    const v = await syncView(host.socket);
    return v.gamePhase === 'directed-questions' ? v : null;
  }, 15000, 'directed');

  for (let i = 0; i < clients.length * 4; i += 1) {
    const v = await syncView(host.socket);
    if (v.gamePhase !== 'directed-questions') break;
    const askerId = v.directedQuestionAskerPlayerId;
    if (!askerId || !byId[askerId]) {
      await sleep(50);
      continue;
    }
    await ack(byId[askerId]!.socket, BARA_AL_SALAFA_ADVANCE_DIRECTED_QUESTION_EVENT, {});
  }

  await waitFor(async () => {
    const v = await syncView(host.socket);
    return v.gamePhase === 'free-questions' || v.gamePhase === 'voting' ? v : null;
  }, 20000, 'free/voting');

  for (let i = 0; i < clients.length * 20; i += 1) {
    const v = await syncView(host.socket);
    if (v.gamePhase === 'voting') break;
    if (v.gamePhase !== 'free-questions') {
      await sleep(50);
      continue;
    }
    const activeId = v.activeFreeQuestionPlayerId;
    if (!activeId || !byId[activeId]) {
      await sleep(50);
      continue;
    }
    await ack(byId[activeId]!.socket, BARA_AL_SALAFA_SKIP_FREE_QUESTION_TURN_EVENT, {});
  }

  await waitFor(async () => {
    const v = await syncView(host.socket);
    return v.gamePhase === 'voting' ? v : null;
  }, 20000, 'voting');

  for (const c of clients) {
    const v = await syncView(c.socket);
    if (v.hasVoted) continue;
    const target = v.votablePlayers?.[0]?.id ?? clients.find((x) => x.id !== c.id)!.id;
    await ack(c.socket, BARA_AL_SALAFA_SUBMIT_VOTE_EVENT, { targetPlayerId: target });
  }

  await waitFor(async () => {
    const v = await syncView(host.socket);
    return ['impostor-guess', 'impostor-guess-result', 'round-results', 'match-completed'].includes(
      v.gamePhase,
    )
      ? v
      : null;
  }, 30000, 'post-vote');

  for (const c of clients) {
    const v = await syncView(c.socket);
    if (v.gamePhase === 'impostor-guess' && v.role === 'impostor') {
      await ack(c.socket, BARA_AL_SALAFA_SUBMIT_IMPOSTOR_GUESS_EVENT, {
        guess: v.impostorGuessOptions?.[0] ?? 'مكة',
      });
    }
  }

  await waitFor(async () => {
    const v = await syncView(host.socket);
    return v.gamePhase === 'round-results' || v.gamePhase === 'match-completed' ? v : null;
  }, 30000, 'results');

  // Test mode is usually 1 round; continue until match-completed.
  for (let i = 0; i < 8; i += 1) {
    const v = await syncView(host.socket);
    if (v.gamePhase === 'match-completed') return;
    if (v.gamePhase === 'round-results') {
      await ack(host.socket, BARA_AL_SALAFA_CONTINUE_ROUND_RESULTS_EVENT, {});
      await sleep(200);
      continue;
    }
    if (v.gamePhase === 'description') {
      for (const c of clients) {
        await ack(c.socket, BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT, {});
      }
    }
    await sleep(300);
  }

  await waitFor(async () => {
    const v = await syncView(host.socket);
    return v.gamePhase === 'match-completed' ? v : null;
  }, 60000, 'match-completed');
}

async function finishDrawToMatchCompleted(clients: TestClient[]): Promise<void> {
  const host = clients[0]!;
  await waitFor(async () => {
    const v = await syncDraw(host.socket);
    return v.gamePhase === 'drawing' ? v : null;
  }, 15000, 'drawing');

  const totalRounds = (await syncDraw(host.socket)).totalRounds;
  for (let round = 1; round <= totalRounds; round += 1) {
    await waitFor(async () => {
      const v = await syncDraw(host.socket);
      return v.gamePhase === 'drawing' && v.currentRound === round ? v : null;
    }, 20000, `draw r${round}`);

    const views = await Promise.all(clients.map(async (c) => ({ c, v: await syncDraw(c.socket) })));
    const drawer = views.find((x) => x.v.role === 'drawer' && x.v.secretWord)!;
    const guesser = views.find((x) => x.c.id !== drawer.c.id)!;
    await ack(guesser.c.socket, DRAW_GUESS_SUBMIT_GUESS_EVENT, { guess: drawer.v.secretWord });

    await waitFor(async () => {
      const v = await syncDraw(host.socket);
      return v.gamePhase === 'round-results' ? v : null;
    }, 10000, `results r${round}`);
    await ack(host.socket, DRAW_GUESS_CONTINUE_ROUND_RESULTS_EVENT, {});
  }

  await waitFor(async () => {
    const v = await syncDraw(host.socket);
    return v.gamePhase === 'match-completed' ? v : null;
  }, 15000, 'draw match-completed');
}

async function hostEarlyLobby(host: TestClient, gameId: string): Promise<void> {
  const event =
    gameId === DRAW_GUESS_GAME_ID
      ? DRAW_GUESS_CONTINUE_ROUND_RESULTS_EVENT
      : BARA_AL_SALAFA_CONTINUE_ROUND_RESULTS_EVENT;
  const res = await ack<{ success: boolean; error?: { message?: string } }>(
    host.socket,
    event,
    {},
  );
  assert.ok(res.success, res.error?.message ?? 'early lobby');
  await waitFor(
    async () => (host.navigations.includes('/lobby') ? true : null),
    10000,
    'lobby nav',
    100,
  );
  await assertNoShell(host, 'host early');
}

async function waitAutoLobby(host: TestClient): Promise<void> {
  await waitFor(async () => {
    const sync = await ack<{
      success: boolean;
      data: { state: { phase: string } | null };
    }>(host.socket, GAME_SHELL_SYNC_EVENT, {});
    return sync.data.state == null ? true : null;
  }, 45000, 'auto lobby shell gone', 400);
  await assertNoShell(host, 'auto lobby');
}

async function disconnectAll(clients: TestClient[]): Promise<void> {
  for (const c of clients) c.socket.disconnect();
  await sleep(50);
}

async function main(): Promise<void> {
  await waitForServer();

  await runTest('Bara → Draw Guess ×3 (host early)', async () => {
    const clients = await createTrio();
    const host = clients[0]!;
    try {
      for (let i = 0; i < 3; i += 1) {
        await startGame(host, clients, BARA_AL_SALAFA_GAME_ID);
        await finishBaraToMatchCompleted(clients);
        await hostEarlyLobby(host, BARA_AL_SALAFA_GAME_ID);
        await startGame(host, clients, DRAW_GUESS_GAME_ID);
        await finishDrawToMatchCompleted(clients);
        await hostEarlyLobby(host, DRAW_GUESS_GAME_ID);
      }
    } finally {
      await disconnectAll(clients);
    }
  });

  await runTest('Draw Guess → Bara ×3 (host early)', async () => {
    const clients = await createTrio();
    const host = clients[0]!;
    try {
      for (let i = 0; i < 3; i += 1) {
        await startGame(host, clients, DRAW_GUESS_GAME_ID);
        await finishDrawToMatchCompleted(clients);
        await hostEarlyLobby(host, DRAW_GUESS_GAME_ID);
        await startGame(host, clients, BARA_AL_SALAFA_GAME_ID);
        await finishBaraToMatchCompleted(clients);
        await hostEarlyLobby(host, BARA_AL_SALAFA_GAME_ID);
      }
    } finally {
      await disconnectAll(clients);
    }
  });

  await runTest('Same-game restart Bara×2 + Draw×2', async () => {
    const clients = await createTrio();
    const host = clients[0]!;
    try {
      for (let i = 0; i < 2; i += 1) {
        await startGame(host, clients, BARA_AL_SALAFA_GAME_ID);
        await finishBaraToMatchCompleted(clients);
        await hostEarlyLobby(host, BARA_AL_SALAFA_GAME_ID);
      }
      for (let i = 0; i < 2; i += 1) {
        await startGame(host, clients, DRAW_GUESS_GAME_ID);
        await finishDrawToMatchCompleted(clients);
        await hostEarlyLobby(host, DRAW_GUESS_GAME_ID);
      }
    } finally {
      await disconnectAll(clients);
    }
  });

  await runTest('Auto-return deletes shell (Bara + Draw)', async () => {
    const clients = await createTrio();
    const host = clients[0]!;
    try {
      await startGame(host, clients, BARA_AL_SALAFA_GAME_ID);
      await finishBaraToMatchCompleted(clients);
      await waitAutoLobby(host);
      await startGame(host, clients, DRAW_GUESS_GAME_ID);
      await finishDrawToMatchCompleted(clients);
      await waitAutoLobby(host);
      await startGame(host, clients, BARA_AL_SALAFA_GAME_ID);
    } finally {
      await disconnectAll(clients);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
