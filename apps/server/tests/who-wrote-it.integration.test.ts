/**
 * Who Wrote It Socket.IO multiplayer flow (Host + B + C + D).
 * Requires server on localhost:4001 with WANASATNA_TEST_MODE=1.
 *
 * Run: pnpm --filter @wanasatna/server test:who-wrote-it:integration
 */
import assert from 'node:assert/strict';
import {
  RECONNECT_EVENT,
  WHO_WROTE_IT_GAME_ID,
  WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
  WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
  WHO_WROTE_IT_SYNC_EVENT,
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
    console.error(error instanceof Error ? error.message : error);
  }
}

async function startWhoWroteItMatch(): Promise<{
  host: TestClient;
  clients: TestClient[];
}> {
  const names = ['محمد', 'خالد', 'سارة', 'عبدالله'] as const;
  const clients: TestClient[] = [];

  const hostSocket = await connectClient();
  const host: TestClient = {
    name: names[0],
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
  assert.ok(createRes.success, 'create-room failed');
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
    assert.ok(joinRes.success, `join-room failed for ${name}`);
    client.id = joinRes.data.player.id;
    client.roomId = joinRes.data.room.id;
    client.reconnectToken = joinRes.data.reconnectToken ?? '';
    clients.push(client);
  }

  const startRes = await ack<{ success: boolean; error?: { message?: string } }>(
    host.socket,
    'game-shell-start-from-lobby',
    { gameId: WHO_WROTE_IT_GAME_ID },
  );
  assert.ok(startRes.success, startRes.error?.message ?? 'start-from-lobby failed');

  await waitFor(
    async () =>
      clients.every((client) => client.shellEvents.some((event) => event.phase === 'PLAYING'))
        ? true
        : null,
    15000,
    'PLAYING phase',
    200,
  );

  await waitFor(async () => {
    const syncRes = await ack<{
      success: boolean;
      data?: { view: { gamePhase: string; question: string | null } };
    }>(host.socket, WHO_WROTE_IT_SYNC_EVENT);
    return syncRes.success && syncRes.data?.view.gamePhase === 'answering'
      ? syncRes.data.view
      : null;
  }, 15000, 'answering phase');

  return { host, clients };
}

type SyncView = {
  gamePhase: string;
  question: string | null;
  currentAnonymousAnswer: { answerId: string; text: string } | null;
  guessOptions: Array<{ playerId: string; name: string }>;
  hasCompletedGuessing: boolean;
  revealEntries: Array<{
    answerId: string;
    text: string;
    ownerPlayerId: string;
    ownerName: string;
  }>;
  roundResults: Array<{ playerId: string; roundPoints: number; correctCount: number }>;
};

async function syncView(client: TestClient): Promise<SyncView> {
  const syncRes = await ack<{ success: boolean; data: { view: SyncView } }>(
    client.socket,
    WHO_WROTE_IT_SYNC_EVENT,
  );
  assert.ok(syncRes.success);
  return syncRes.data.view;
}

async function completeGuessing(client: TestClient): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    const view = await syncView(client);
    if (view.gamePhase !== 'guessing' || view.hasCompletedGuessing || !view.currentAnonymousAnswer) {
      return;
    }

    const option = view.guessOptions[0];
    assert.ok(option, 'expected guess option');
    const guessRes = await ack<{ success: boolean; error?: { message?: string } }>(
      client.socket,
      WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
      {
        answerId: view.currentAnonymousAnswer.answerId,
        ownerPlayerId: option.playerId,
      },
    );
    assert.ok(guessRes.success, guessRes.error?.message ?? 'guess failed');
  }
}

async function main(): Promise<void> {
  console.log('[who-wrote-it] waiting for test server...');
  await waitForServer();

  await runTest('Host+B+C+D full round → shared reveal mappings', async () => {
    const { clients } = await startWhoWroteItMatch();
    const answers = ['أنام إذا طفشت', 'أطلب بيتزا', 'أسافر فوراً', 'أتصل بأمي'];

    const questions = await Promise.all(clients.map((client) => syncView(client)));
    for (const view of questions) {
      assert.equal(view.gamePhase, 'answering');
      assert.equal(view.question, questions[0]!.question);
    }

    for (const [index, client] of clients.entries()) {
      const submitRes = await ack<{ success: boolean }>(
        client.socket,
        WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
        { answer: answers[index]! },
      );
      assert.ok(submitRes.success);
    }

    await waitFor(async () => {
      const view = await syncView(clients[0]!);
      return view.gamePhase === 'guessing' ? view : null;
    }, 10000, 'guessing phase');

    for (const client of clients) {
      const view = await syncView(client);
      assert.equal(view.gamePhase, 'guessing');
      assert.ok(view.currentAnonymousAnswer || view.hasCompletedGuessing);
      const serialized = JSON.stringify(view.currentAnonymousAnswer);
      if (view.currentAnonymousAnswer) {
        assert.equal(serialized.includes('ownerPlayerId'), false);
      }
    }

    // Reconnect mid-guess for player B
    const playerB = clients[1]!;
    const beforeDisconnect = await syncView(playerB);
    assert.ok(beforeDisconnect.currentAnonymousAnswer);
    const firstAnswerId = beforeDisconnect.currentAnonymousAnswer.answerId;
    const firstOption = beforeDisconnect.guessOptions[0]!;
    const firstGuess = await ack<{ success: boolean }>(
      playerB.socket,
      WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
      { answerId: firstAnswerId, ownerPlayerId: firstOption.playerId },
    );
    assert.ok(firstGuess.success);

    const afterFirst = await syncView(playerB);
    const orderAfterFirst = afterFirst.currentAnonymousAnswer?.answerId ?? null;

    playerB.socket.disconnect();
    const reconnected = await connectClient();
    playerB.socket = reconnected;
    trackClientEvents(playerB);

    const resumeRes = await ack<{ success: boolean; error?: { message?: string } }>(
      reconnected,
      RECONNECT_EVENT,
      {
        playerId: playerB.id,
        roomId: playerB.roomId,
        roomCode: playerB.roomCode,
        reconnectToken: playerB.reconnectToken,
      },
    );
    assert.ok(resumeRes.success, resumeRes.error?.message ?? 'reconnect failed');

    await waitFor(async () => {
      const view = await syncView(playerB);
      return view.gamePhase === 'guessing' ? view : null;
    }, 10000, 'reconnect guessing');

    const afterReconnect = await syncView(playerB);
    assert.equal(afterReconnect.gamePhase, 'guessing');
    assert.equal(afterReconnect.currentAnonymousAnswer?.answerId ?? null, orderAfterFirst);

    for (const client of clients) {
      await completeGuessing(client);
    }

    await waitFor(async () => {
      const view = await syncView(clients[0]!);
      return view.gamePhase === 'round-results' ? view : null;
    }, 15000, 'round-results');

    const reveals = await Promise.all(clients.map((client) => syncView(client)));
    for (const view of reveals) {
      assert.equal(view.gamePhase, 'round-results');
      assert.ok(view.revealEntries.length >= 3);
    }

    const mappingA = reveals[0]!.revealEntries
      .map((entry) => `${entry.answerId}:${entry.ownerPlayerId}`)
      .sort()
      .join('|');
    for (const view of reveals.slice(1)) {
      const mapping = view.revealEntries
        .map((entry) => `${entry.answerId}:${entry.ownerPlayerId}`)
        .sort()
        .join('|');
      assert.equal(mapping, mappingA);
    }

    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
