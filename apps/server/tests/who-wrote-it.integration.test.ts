/**
 * Who Wrote It Socket.IO — global synchronized guessing.
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

type SyncView = {
  gamePhase: string;
  question: string | null;
  currentAnonymousAnswer: { answerId: string; text: string } | null;
  isOwnAnswer: boolean;
  hasGuessedCurrentAnswer: boolean;
  canSubmitGuess: boolean;
  guessingProgressIndex: number;
  guessingProgressTotal: number;
  guessOptions: Array<{ playerId: string; name: string }>;
  revealEntries: Array<{
    answerId: string;
    text: string;
    ownerPlayerId: string;
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
    const view = await syncView(host);
    return view.gamePhase === 'answering' ? view : null;
  }, 15000, 'answering phase');

  return { host, clients };
}

async function main(): Promise<void> {
  console.log('[who-wrote-it] waiting for test server...');
  await waitForServer();

  await runTest('global guessing: sync advance + reconnect + reveal', async () => {
    const { clients } = await startWhoWroteItMatch();
    const [host, playerB, playerC, playerD] = clients;
    assert.ok(host && playerB && playerC && playerD);

    const answersByClient = new Map<string, string>([
      [host.id, 'إجابة محمد'],
      [playerB.id, 'إجابة خالد'],
      [playerC.id, 'إجابة سارة'],
      [playerD.id, 'إجابة عبدالله'],
    ]);

    for (const client of clients) {
      const submitRes = await ack<{ success: boolean }>(
        client.socket,
        WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
        { answer: answersByClient.get(client.id)! },
      );
      assert.ok(submitRes.success);
    }

    await waitFor(async () => {
      const view = await syncView(host);
      return view.gamePhase === 'guessing' ? view : null;
    }, 10000, 'guessing phase');

    const firstViews = await Promise.all(clients.map((client) => syncView(client)));
    const firstAnswerId = firstViews[0]!.currentAnonymousAnswer?.answerId;
    assert.ok(firstAnswerId);
    assert.ok(
      firstViews.every((view) => view.currentAnonymousAnswer?.answerId === firstAnswerId),
    );
    assert.equal(firstViews[0]!.guessingProgressIndex, 1);
    assert.equal(firstViews[0]!.guessingProgressTotal, 4);

    const ownerClient = clients.find((client, index) => firstViews[index]!.isOwnAnswer);
    assert.ok(ownerClient, 'exactly one owner for current answer');
    const ownerView = await syncView(ownerClient);
    assert.equal(ownerView.isOwnAnswer, true);
    assert.equal(ownerView.canSubmitGuess, false);

    const ownerGuessAttempt = await ack<{ success: boolean }>(
      ownerClient.socket,
      WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
      { answerId: firstAnswerId, ownerPlayerId: host.id },
    );
    assert.equal(ownerGuessAttempt.success, false);

    const guessers = clients.filter((client) => client.id !== ownerClient.id);
    assert.equal(guessers.length, 3);

    // Partial submissions must NOT advance
    const g0 = guessers[0]!;
    const g0View = await syncView(g0);
    const option0 = g0View.guessOptions[0]!;
    assert.ok(option0);
    assert.ok(option0.playerId !== g0.id);

    const guess0 = await ack<{ success: boolean }>(
      g0.socket,
      WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
      { answerId: firstAnswerId, ownerPlayerId: option0.playerId },
    );
    assert.ok(guess0.success);

    const afterOne = await Promise.all(clients.map((client) => syncView(client)));
    assert.ok(
      afterOne.every((view) => view.currentAnonymousAnswer?.answerId === firstAnswerId),
    );

    const g1 = guessers[1]!;
    const g1View = await syncView(g1);
    const guess1 = await ack<{ success: boolean }>(
      g1.socket,
      WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
      { answerId: firstAnswerId, ownerPlayerId: g1View.guessOptions[0]!.playerId },
    );
    assert.ok(guess1.success);

    const afterTwo = await Promise.all(clients.map((client) => syncView(client)));
    assert.ok(
      afterTwo.every((view) => view.currentAnonymousAnswer?.answerId === firstAnswerId),
    );

    // Reconnect a guesser who already submitted while still on answer #1
    g0.socket.disconnect();
    const reconnected = await connectClient();
    g0.socket = reconnected;
    trackClientEvents(g0);
    const resumeRes = await ack<{ success: boolean; error?: { message?: string } }>(
      reconnected,
      RECONNECT_EVENT,
      {
        playerId: g0.id,
        roomId: g0.roomId,
        roomCode: g0.roomCode,
        reconnectToken: g0.reconnectToken,
      },
    );
    assert.ok(resumeRes.success, resumeRes.error?.message ?? 'reconnect failed');

    const afterReconnect = await syncView(g0);
    assert.equal(afterReconnect.gamePhase, 'guessing');
    assert.equal(afterReconnect.currentAnonymousAnswer?.answerId, firstAnswerId);
    assert.equal(afterReconnect.hasGuessedCurrentAnswer, true);
    assert.equal(afterReconnect.canSubmitGuess, false);

    const g2 = guessers[2]!;
    const g2View = await syncView(g2);
    const guess2 = await ack<{ success: boolean }>(
      g2.socket,
      WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
      { answerId: firstAnswerId, ownerPlayerId: g2View.guessOptions[0]!.playerId },
    );
    assert.ok(guess2.success);

    await waitFor(async () => {
      const view = await syncView(host);
      if (view.gamePhase === 'round-results') {
        return view;
      }
      if (
        view.gamePhase === 'guessing' &&
        view.currentAnonymousAnswer?.answerId &&
        view.currentAnonymousAnswer.answerId !== firstAnswerId
      ) {
        return view;
      }
      return null;
    }, 10000, 'advance after all required guesses');

    // Finish remaining answers
    for (let step = 0; step < 8; step += 1) {
      const views = await Promise.all(clients.map((client) => syncView(client)));
      if (views.every((view) => view.gamePhase === 'round-results')) {
        break;
      }

      assert.ok(
        views.every(
          (view) =>
            view.currentAnonymousAnswer?.answerId ===
            views[0]!.currentAnonymousAnswer?.answerId,
        ),
      );

      const currentId = views[0]!.currentAnonymousAnswer?.answerId;
      assert.ok(currentId);

      for (const [index, client] of clients.entries()) {
        const view = views[index]!;
        if (!view.canSubmitGuess || view.isOwnAnswer || view.hasGuessedCurrentAnswer) {
          continue;
        }
        const option = view.guessOptions[0];
        assert.ok(option);
        const res = await ack<{ success: boolean; error?: { message?: string } }>(
          client.socket,
          WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
          { answerId: currentId, ownerPlayerId: option.playerId },
        );
        assert.ok(res.success, res.error?.message ?? 'guess failed');
      }
    }

    await waitFor(async () => {
      const view = await syncView(host);
      return view.gamePhase === 'round-results' ? view : null;
    }, 15000, 'round-results');

    const reveals = await Promise.all(clients.map((client) => syncView(client)));
    for (const view of reveals) {
      assert.equal(view.gamePhase, 'round-results');
      assert.equal(view.revealEntries.length, 4);
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
