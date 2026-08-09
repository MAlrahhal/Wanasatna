/**
 * Fast Answer Socket.IO race integration (Host + B + C).
 * Requires server on localhost:4001 with WANASATNA_TEST_MODE=1.
 *
 * Run: pnpm --filter @wanasatna/server test:fast-answer:integration
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FAST_ANSWER_GAME_ID,
  FAST_ANSWER_SUBMIT_ANSWER_EVENT,
  FAST_ANSWER_SYNC_EVENT,
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

type ContentQuestion = {
  question: string;
  acceptedAnswers: string[];
};

const contentQuestions = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../content/fast-answer/questions.json'),
    'utf8',
  ),
) as ContentQuestion[];

function answerForQuestion(question: string): string {
  const entry = contentQuestions.find((item) => item.question === question);
  assert.ok(entry, `missing content for question: ${question}`);
  return entry.acceptedAnswers[0]!;
}

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

async function startFastAnswerMatch(): Promise<{
  host: TestClient;
  clients: TestClient[];
}> {
  const names = ['محمد', 'خالد', 'علي'] as const;
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
  assert.ok(createRes.success);
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
    { gameId: FAST_ANSWER_GAME_ID },
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
    }>(host.socket, FAST_ANSWER_SYNC_EVENT);
    return syncRes.success && syncRes.data?.view.gamePhase === 'question'
      ? syncRes.data.view
      : null;
  }, 15000, 'question phase');

  return { host, clients };
}

async function main(): Promise<void> {
  console.log('[fast-answer] waiting for test server...');
  await waitForServer();

  await runTest('sync privacy: no revealed answer during question', async () => {
    const { clients } = await startFastAnswerMatch();

    for (const client of clients) {
      const syncRes = await ack<{
        success: boolean;
        data: { view: Record<string, unknown> };
      }>(client.socket, FAST_ANSWER_SYNC_EVENT);
      assert.ok(syncRes.success);
      assert.equal(syncRes.data.view.gamePhase, 'question');
      assert.equal(syncRes.data.view.revealedAnswer, null);
      assert.equal(syncRes.data.view.winnerPlayerId, null);
      assert.equal('acceptedAnswers' in syncRes.data.view, false);
      assert.ok(typeof syncRes.data.view.question === 'string');
    }

    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  await runTest('wrong then correct ends round for sender only path', async () => {
    const { clients } = await startFastAnswerMatch();
    const [host, playerB] = clients;
    const syncRes = await ack<{
      success: boolean;
      data: { view: { question: string } };
    }>(host!.socket, FAST_ANSWER_SYNC_EVENT);
    assert.ok(syncRes.success);
    const answer = answerForQuestion(syncRes.data.view.question);

    const wrong = await ack<{ success: boolean; data?: { correct: boolean } }>(
      playerB!.socket,
      FAST_ANSWER_SUBMIT_ANSWER_EVENT,
      { answer: 'إجابة-خاطئة-تماماً' },
    );
    assert.ok(wrong.success);
    assert.equal(wrong.data?.correct, false);

    const correct = await ack<{
      success: boolean;
      data?: {
        correct: boolean;
        view: { gamePhase: string; winnerPlayerId: string | null; revealedAnswer: string | null };
      };
    }>(playerB!.socket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, { answer });
    assert.ok(correct.success);
    assert.equal(correct.data?.correct, true);
    assert.equal(correct.data?.view.gamePhase, 'round-results');
    assert.equal(correct.data?.view.winnerPlayerId, playerB!.id);
    assert.ok(correct.data?.view.revealedAnswer);

    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  await runTest('Host+B+C concurrent correct → single winner', async () => {
    const { clients } = await startFastAnswerMatch();
    const [host, playerB, playerC] = clients;

    const syncRes = await ack<{
      success: boolean;
      data: { view: { question: string } };
    }>(host!.socket, FAST_ANSWER_SYNC_EVENT);
    assert.ok(syncRes.success);
    const answer = answerForQuestion(syncRes.data.view.question);

    const [resultB, resultC] = await Promise.all([
      ack<{
        success: boolean;
        data?: { correct: boolean; view: { winnerPlayerId: string | null; gamePhase: string } };
      }>(playerB!.socket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, { answer }),
      ack<{
        success: boolean;
        data?: { correct: boolean; view: { winnerPlayerId: string | null; gamePhase: string } };
      }>(playerC!.socket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, { answer }),
    ]);

    const correctResults = [resultB, resultC].filter(
      (result) => result.success && result.data?.correct,
    );
    assert.equal(correctResults.length, 1, 'only one concurrent submitter should win');

    const winnerId = correctResults[0]!.data!.view.winnerPlayerId;
    assert.ok(winnerId === playerB!.id || winnerId === playerC!.id);

    const syncAfter = await ack<{
      success: boolean;
      data: {
        view: {
          gamePhase: string;
          winnerPlayerId: string | null;
          roundResults: Array<{ playerId: string; roundPoints: number }>;
        };
      };
    }>(host!.socket, FAST_ANSWER_SYNC_EVENT);

    assert.ok(syncAfter.success);
    assert.equal(syncAfter.data.view.gamePhase, 'round-results');
    assert.equal(syncAfter.data.view.winnerPlayerId, winnerId);
    assert.equal(
      syncAfter.data.view.roundResults.find((entry) => entry.playerId === winnerId)?.roundPoints,
      100,
    );
    assert.ok(
      syncAfter.data.view.roundResults
        .filter((entry) => entry.playerId !== winnerId)
        .every((entry) => entry.roundPoints === 0),
    );

    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
