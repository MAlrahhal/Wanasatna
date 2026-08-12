/**
 * Fast Answer Socket.IO integration.
 * Requires server on localhost:4001 with WANASATNA_TEST_MODE=1.
 *
 * Run: pnpm --filter @wanasatna/server test:fast-answer:integration
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FAST_ANSWER_CONTINUE_ROUND_RESULTS_EVENT,
  FAST_ANSWER_DEFAULT_ROUNDS,
  FAST_ANSWER_GAME_ID,
  FAST_ANSWER_SUBMIT_ANSWER_EVENT,
  FAST_ANSWER_SYNC_EVENT,
  TIMING_CHALLENGE_GAME_ID,
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
  categoryId: string;
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

async function createRoomWithPlayers(playerCount: number): Promise<{
  host: TestClient;
  clients: TestClient[];
}> {
  const names = Array.from({ length: playerCount }, (_, index) => `لاعب${index + 1}`);
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

  return { host, clients };
}

async function startFastAnswerMatch(
  playerCount = 3,
  categoryId: string | null = 'countries',
): Promise<{
  host: TestClient;
  clients: TestClient[];
}> {
  const { host, clients } = await createRoomWithPlayers(playerCount);

  const startRes = await ack<{ success: boolean; error?: { message?: string } }>(
    host.socket,
    'game-shell-start-from-lobby',
    { gameId: FAST_ANSWER_GAME_ID, categoryId },
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

async function syncView(client: TestClient) {
  const syncRes = await ack<{
    success: boolean;
    data: {
      view: {
        gamePhase: string;
        question: string | null;
        roundId: string | null;
        categoryId: string | null;
        currentRound: number;
        totalRounds: number;
        canSubmitAnswer: boolean;
        isMatchSpectator: boolean;
        revealedAnswer: string | null;
        winnerPlayerId: string | null;
        roundResults: Array<{ playerId: string; roundPoints: number }>;
      };
    };
  }>(client.socket, FAST_ANSWER_SYNC_EVENT);
  assert.ok(syncRes.success);
  return syncRes.data.view;
}

async function main(): Promise<void> {
  console.log('[fast-answer] waiting for test server...');
  await waitForServer();

  await runTest('sync privacy + locked category + 5 rounds', async () => {
    const { clients } = await startFastAnswerMatch(2, 'football');

    for (const client of clients) {
      const view = await syncView(client);
      assert.equal(view.gamePhase, 'question');
      assert.equal(view.revealedAnswer, null);
      assert.equal(view.winnerPlayerId, null);
      assert.equal('acceptedAnswers' in view, false);
      assert.ok(typeof view.question === 'string');
      assert.equal(view.totalRounds, FAST_ANSWER_DEFAULT_ROUNDS);
      assert.equal(view.categoryId, 'football');
      assert.ok(view.roundId);
      const entry = contentQuestions.find((item) => item.question === view.question);
      assert.equal(entry?.categoryId, 'football');
    }

    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  await runTest('wrong then correct ends round; roundId required', async () => {
    const { clients } = await startFastAnswerMatch(2, 'countries');
    const [host, playerB] = clients;
    const view = await syncView(host!);
    const answer = answerForQuestion(view.question!);

    const wrong = await ack<{ success: boolean; data?: { correct: boolean } }>(
      playerB!.socket,
      FAST_ANSWER_SUBMIT_ANSWER_EVENT,
      { answer: 'إجابة-خاطئة-تماماً', roundId: view.roundId },
    );
    assert.ok(wrong.success);
    assert.equal(wrong.data?.correct, false);

    const stale = await ack<{ success: boolean }>(
      playerB!.socket,
      FAST_ANSWER_SUBMIT_ANSWER_EVENT,
      { answer, roundId: 'stale-round-id' },
    );
    assert.equal(stale.success, false);

    const correct = await ack<{
      success: boolean;
      data?: {
        correct: boolean;
        view: { gamePhase: string; winnerPlayerId: string | null; revealedAnswer: string | null };
      };
    }>(playerB!.socket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, {
      answer,
      roundId: view.roundId,
    });
    assert.ok(correct.success);
    assert.equal(correct.data?.correct, true);
    assert.equal(correct.data?.view.gamePhase, 'round-results');
    assert.equal(correct.data?.view.winnerPlayerId, playerB!.id);
    assert.ok(correct.data?.view.revealedAnswer);

    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  await runTest('concurrent correct → single winner', async () => {
    const { clients } = await startFastAnswerMatch(3, 'tech');
    const [host, playerB, playerC] = clients;
    const view = await syncView(host!);
    const answer = answerForQuestion(view.question!);

    const [resultB, resultC] = await Promise.all([
      ack<{
        success: boolean;
        data?: { correct: boolean; view: { winnerPlayerId: string | null; gamePhase: string } };
      }>(playerB!.socket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, {
        answer,
        roundId: view.roundId,
      }),
      ack<{
        success: boolean;
        data?: { correct: boolean; view: { winnerPlayerId: string | null; gamePhase: string } };
      }>(playerC!.socket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, {
        answer,
        roundId: view.roundId,
      }),
    ]);

    const correctResults = [resultB, resultC].filter(
      (result) => result.success && result.data?.correct,
    );
    assert.equal(correctResults.length, 1, 'only one concurrent submitter should win');

    const winnerId = correctResults[0]!.data!.view.winnerPlayerId;
    assert.ok(winnerId === playerB!.id || winnerId === playerC!.id);

    const syncAfter = await syncView(host!);
    assert.equal(syncAfter.gamePhase, 'round-results');
    assert.equal(syncAfter.winnerPlayerId, winnerId);
    assert.equal(
      syncAfter.roundResults.find((entry) => entry.playerId === winnerId)?.roundPoints,
      100,
    );

    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  await runTest('spectator mid-join cannot submit', async () => {
    const { host, clients } = await startFastAnswerMatch(2, 'animals');
    const view = await syncView(host);

    const spectatorSocket = await connectClient();
    const joinRes = await ack<{
      success: boolean;
      data: { player: { id: string } };
    }>(spectatorSocket, 'join-room', {
      roomCode: host.roomCode,
      playerName: 'مشاهد',
    });
    assert.ok(joinRes.success);

    const spectatorView = await ack<{
      success: boolean;
      data: { view: { isMatchSpectator: boolean; canSubmitAnswer: boolean; revealedAnswer: string | null } };
    }>(spectatorSocket, FAST_ANSWER_SYNC_EVENT);
    assert.ok(spectatorView.success);
    assert.equal(spectatorView.data.view.isMatchSpectator, true);
    assert.equal(spectatorView.data.view.canSubmitAnswer, false);
    assert.equal(spectatorView.data.view.revealedAnswer, null);

    const submit = await ack<{ success: boolean }>(
      spectatorSocket,
      FAST_ANSWER_SUBMIT_ANSWER_EVENT,
      { answer: answerForQuestion(view.question!), roundId: view.roundId },
    );
    assert.equal(submit.success, false);

    spectatorSocket.disconnect();
    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  await runTest('host skip results + complete match cleanup allows next game', async () => {
    const { host, clients } = await startFastAnswerMatch(2, 'movies');

    for (let round = 1; round <= FAST_ANSWER_DEFAULT_ROUNDS; round += 1) {
      const view = await waitFor(async () => {
        const current = await syncView(host);
        return current.gamePhase === 'question' && current.currentRound === round
          ? current
          : null;
      }, 20000, `question round ${round}`);

      assert.equal(view.categoryId, 'movies');
      assert.equal(view.totalRounds, 5);
      assert.ok(view.roundId);

      const answer = answerForQuestion(view.question!);
      const win = await ack<{
        success: boolean;
        error?: { message?: string };
        data?: { correct: boolean; view?: { gamePhase: string } };
      }>(clients[1]!.socket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, {
        answer,
        roundId: view.roundId,
      });
      assert.ok(
        win.success && win.data?.correct,
        `round ${round} win failed: ${win.error?.message ?? JSON.stringify(win)}`,
      );

      const after = await waitFor(async () => {
        const current = await syncView(host);
        if (current.gamePhase === 'round-results' && current.currentRound === round) {
          return current;
        }
        if (round < FAST_ANSWER_DEFAULT_ROUNDS && current.gamePhase === 'question' && current.currentRound === round + 1) {
          return current;
        }
        if (round === FAST_ANSWER_DEFAULT_ROUNDS && current.gamePhase === 'match-completed') {
          return current;
        }
        return null;
      }, 10000, `post-win round ${round}`);

      if (after.gamePhase === 'round-results') {
        const cont = await ack<{ success: boolean; error?: { message?: string } }>(
          host.socket,
          FAST_ANSWER_CONTINUE_ROUND_RESULTS_EVENT,
        );
        assert.ok(cont.success, `continue round ${round}: ${cont.error?.message ?? 'failed'}`);
      }
    }

    const finalOrLobby = await waitFor(async () => {
      try {
        const current = await syncView(host);
        if (current.gamePhase === 'match-completed') {
          return current;
        }
      } catch {
        // shell may already be deleted
      }
      if (host.navigations.some((path) => String(path).includes('lobby'))) {
        return 'lobby' as const;
      }
      return null;
    }, 20000, 'final or lobby');

    if (finalOrLobby !== 'lobby') {
      const done = await ack<{ success: boolean; error?: { message?: string } }>(
        host.socket,
        FAST_ANSWER_CONTINUE_ROUND_RESULTS_EVENT,
      );
      assert.ok(done.success, done.error?.message ?? 'final return failed');
    }

    await waitFor(
      async () => (host.navigations.some((path) => String(path).includes('lobby')) ? true : null),
      15000,
      'navigate lobby',
    );

    const nextStart = await ack<{ success: boolean; error?: { message?: string } }>(
      host.socket,
      'game-shell-start-from-lobby',
      { gameId: TIMING_CHALLENGE_GAME_ID },
    );
    assert.ok(
      nextStart.success,
      nextStart.error?.message ?? 'expected A→Lobby→B without stale shell',
    );

    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  await runTest('8 players can start', async () => {
    const { clients } = await startFastAnswerMatch(8, 'games');
    const view = await syncView(clients[0]!);
    assert.equal(view.gamePhase, 'question');
    assert.equal(view.totalRounds, 5);
    assert.equal(view.categoryId, 'games');

    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
