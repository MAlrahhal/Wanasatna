/**
 * Judge Socket.IO multiplayer (Host + B + C + D).
 * Requires server on localhost:4001 with WANASATNA_TEST_MODE=1.
 *
 * Run: pnpm --filter @wanasatna/server test:judge:integration
 */
import assert from 'node:assert/strict';
import {
  JUDGE_GAME_ID,
  JUDGE_SELECT_WINNER_EVENT,
  JUDGE_SUBMIT_ANSWER_EVENT,
  JUDGE_SYNC_EVENT,
  RECONNECT_EVENT,
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
  prompt: string | null;
  isJudge: boolean;
  judgePlayerId: string | null;
  canSubmitAnswer: boolean;
  canSelectWinner: boolean;
  anonymousAnswers: Array<{ answerId: string; text: string }>;
  winningAnswerText: string | null;
  winnerName: string | null;
  revealEntries: Array<{ answerId: string; ownerPlayerId: string; text: string; isWinner: boolean }>;
  roundResults: Array<{ playerId: string; roundPoints: number }>;
};

async function syncView(client: TestClient): Promise<SyncView> {
  const syncRes = await ack<{ success: boolean; data: { view: SyncView } }>(
    client.socket,
    JUDGE_SYNC_EVENT,
  );
  assert.ok(syncRes.success);
  return syncRes.data.view;
}

async function startJudgeMatch(): Promise<{ clients: TestClient[] }> {
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
    assert.ok(joinRes.success);
    client.id = joinRes.data.player.id;
    client.roomId = joinRes.data.room.id;
    client.reconnectToken = joinRes.data.reconnectToken ?? '';
    clients.push(client);
  }

  const startRes = await ack<{ success: boolean; error?: { message?: string } }>(
    host.socket,
    'game-shell-start-from-lobby',
    { gameId: JUDGE_GAME_ID },
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

  await waitFor(async () => {
    const view = await syncView(host);
    return view.gamePhase === 'answering' ? view : null;
  }, 15000, 'answering');

  return { clients };
}

async function main(): Promise<void> {
  console.log('[judge] waiting for test server...');
  await waitForServer();

  await runTest('Host+B+C+D judge select + reconnect + shared reveal', async () => {
    const { clients } = await startJudgeMatch();
    const views = await Promise.all(clients.map((c) => syncView(c)));
    const prompts = views.map((v) => v.prompt);
    assert.ok(prompts[0]);
    assert.ok(prompts.every((p) => p === prompts[0]));

    const judgeClient = clients.find((_, index) => views[index]!.isJudge);
    assert.ok(judgeClient);
    const judgeId = judgeClient.id;

    const judgeView = await syncView(judgeClient);
    assert.equal(judgeView.canSubmitAnswer, false);

    const judgeSubmit = await ack<{ success: boolean }>(
      judgeClient.socket,
      JUDGE_SUBMIT_ANSWER_EVENT,
      { answer: 'لا يجب' },
    );
    assert.equal(judgeSubmit.success, false);

    const answerers = clients.filter((c) => c.id !== judgeId);
    for (const [index, client] of answerers.entries()) {
      const res = await ack<{ success: boolean }>(client.socket, JUDGE_SUBMIT_ANSWER_EVENT, {
        answer: `إجابة ${index + 1}`,
      });
      assert.ok(res.success);
    }

    await waitFor(async () => {
      const view = await syncView(judgeClient);
      return view.gamePhase === 'judging' ? view : null;
    }, 10000, 'judging');

    const judgingViews = await Promise.all(clients.map((c) => syncView(c)));
    const cardKey = judgingViews[0]!.anonymousAnswers.map((a) => a.answerId).join('|');
    assert.ok(cardKey);
    for (const [index, view] of judgingViews.entries()) {
      assert.equal(view.anonymousAnswers.map((a) => a.answerId).join('|'), cardKey);
      assert.equal(view.judgePlayerId, judgeId);
      assert.equal(view.isJudge, clients[index]!.id === judgeId);
    }

    // Non-judge cannot select
    const nonJudge = answerers[0]!;
    const rejectSelect = await ack<{ success: boolean }>(
      nonJudge.socket,
      JUDGE_SELECT_WINNER_EVENT,
      { answerId: judgingViews[0]!.anonymousAnswers[0]!.answerId },
    );
    assert.equal(rejectSelect.success, false);

    // Judge reconnect during judging
    const orderBefore = cardKey;
    judgeClient.socket.disconnect();
    const reconnected = await connectClient();
    judgeClient.socket = reconnected;
    trackClientEvents(judgeClient);
    const resumeRes = await ack<{ success: boolean; error?: { message?: string } }>(
      reconnected,
      RECONNECT_EVENT,
      {
        playerId: judgeClient.id,
        roomId: judgeClient.roomId,
        roomCode: judgeClient.roomCode,
        reconnectToken: judgeClient.reconnectToken,
      },
    );
    assert.ok(resumeRes.success, resumeRes.error?.message ?? 'reconnect failed');

    const afterReconnect = await syncView(judgeClient);
    assert.equal(afterReconnect.gamePhase, 'judging');
    assert.equal(afterReconnect.isJudge, true);
    assert.equal(
      afterReconnect.anonymousAnswers.map((a) => a.answerId).join('|'),
      orderBefore,
    );
    assert.equal(afterReconnect.canSelectWinner, true);

    // Find C's answer text mapping: pick answer that will map to answerers[1]
    // We don't know owners yet — select first card, then verify scores converge
    const winnerAnswerId = afterReconnect.anonymousAnswers[0]!.answerId;
    const selectRes = await ack<{ success: boolean; error?: { message?: string } }>(
      judgeClient.socket,
      JUDGE_SELECT_WINNER_EVENT,
      { answerId: winnerAnswerId },
    );
    assert.ok(selectRes.success, selectRes.error?.message ?? 'select failed');

    const doubleSelect = await ack<{ success: boolean }>(
      judgeClient.socket,
      JUDGE_SELECT_WINNER_EVENT,
      { answerId: winnerAnswerId },
    );
    assert.equal(doubleSelect.success, false);

    await waitFor(async () => {
      const view = await syncView(clients[0]!);
      return view.gamePhase === 'round-results' ? view : null;
    }, 10000, 'round-results');

    const results = await Promise.all(clients.map((c) => syncView(c)));
    for (const view of results) {
      assert.equal(view.gamePhase, 'round-results');
      assert.equal(view.revealEntries.length, 3);
      assert.ok(view.winningAnswerText);
      assert.ok(view.winnerName);
    }

    const mapping = results[0]!.revealEntries
      .map((e) => `${e.answerId}:${e.ownerPlayerId}`)
      .sort()
      .join('|');
    for (const view of results.slice(1)) {
      assert.equal(
        view.revealEntries.map((e) => `${e.answerId}:${e.ownerPlayerId}`).sort().join('|'),
        mapping,
      );
    }

    const winnerEntry = results[0]!.revealEntries.find((e) => e.isWinner);
    assert.ok(winnerEntry);
    const winnerPoints = results[0]!.roundResults.find(
      (r) => r.playerId === winnerEntry.ownerPlayerId,
    );
    assert.equal(winnerPoints?.roundPoints, 100);

    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
