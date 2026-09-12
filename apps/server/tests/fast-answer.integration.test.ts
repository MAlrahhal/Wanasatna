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
import { reconnectClient } from './helpers/lifecycle-driver.js';

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

  await waitFor(
    async () => {
      const syncRes = await ack<{
        success: boolean;
        data?: { view: { gamePhase: string; question: string | null } };
      }>(host.socket, FAST_ANSWER_SYNC_EVENT);
      return syncRes.success && syncRes.data?.view.gamePhase === 'question'
        ? syncRes.data.view
        : null;
    },
    15000,
    'question phase',
  );

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
        categoryLabel: string | null;
        currentRound: number;
        totalRounds: number;
        canSubmitAnswer: boolean;
        hasAnsweredCorrectly: boolean;
        correctAnswerPlacement: number | null;
        correctAnswerPoints: number;
        isMatchSpectator: boolean;
        revealedAnswer: string | null;
        winnerPlayerId: string | null;
        roundResults: Array<{ playerId: string; roundPoints: number; placement: number | null }>;
      };
    };
  }>(client.socket, FAST_ANSWER_SYNC_EVENT);
  assert.ok(syncRes.success);
  return syncRes.data.view;
}

async function submitCorrectForAll(
  clients: readonly TestClient[],
  view: Awaited<ReturnType<typeof syncView>>,
): Promise<void> {
  const answer = answerForQuestion(view.question!);

  for (const client of clients) {
    const result = await ack<{
      success: boolean;
      error?: { message?: string };
      data?: { correct: boolean };
    }>(client.socket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, {
      answer,
      roundId: view.roundId,
    });
    assert.ok(
      result.success && result.data?.correct,
      result.error?.message ?? `correct answer failed for ${client.id}`,
    );
  }
}

async function main(): Promise<void> {
  console.log('[fast-answer] waiting for test server...');
  await waitForServer();

  await runTest('sync privacy + locked category + 5 rounds', async () => {
    const { clients } = await startFastAnswerMatch(2, 'series');

    for (const client of clients) {
      const view = await syncView(client);
      assert.equal(view.gamePhase, 'question');
      assert.equal(view.revealedAnswer, null);
      assert.equal(view.winnerPlayerId, null);
      assert.equal(view.hasAnsweredCorrectly, false);
      assert.equal(view.correctAnswerPlacement, null);
      assert.equal(view.correctAnswerPoints, 0);
      assert.equal('acceptedAnswers' in view, false);
      assert.ok(typeof view.question === 'string');
      assert.equal(view.totalRounds, FAST_ANSWER_DEFAULT_ROUNDS);
      assert.equal(view.categoryId, 'series');
      assert.ok(view.roundId);
      const entry = contentQuestions.find((item) => item.question === view.question);
      assert.equal(entry?.categoryId, 'series');
    }

    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  await runTest('wrong does not place; 2 players score 100 / 75 before round ends', async () => {
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
        view: {
          gamePhase: string;
          winnerPlayerId: string | null;
          revealedAnswer: string | null;
          correctAnswerPlacement: number | null;
          correctAnswerPoints: number;
        };
      };
    }>(playerB!.socket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, {
      answer,
      roundId: view.roundId,
    });
    assert.ok(correct.success);
    assert.equal(correct.data?.correct, true);
    assert.equal(correct.data?.view.gamePhase, 'question');
    assert.equal(correct.data?.view.winnerPlayerId, null);
    assert.equal(correct.data?.view.revealedAnswer, null);
    assert.equal(correct.data?.view.correctAnswerPlacement, 1);
    assert.equal(correct.data?.view.correctAnswerPoints, 100);

    const duplicate = await ack<{ success: boolean }>(
      playerB!.socket,
      FAST_ANSWER_SUBMIT_ANSWER_EVENT,
      { answer, roundId: view.roundId },
    );
    assert.equal(duplicate.success, false);

    const afterFirst = await syncView(host!);
    assert.equal(afterFirst.gamePhase, 'question');
    assert.equal(afterFirst.canSubmitAnswer, true);

    const wrongAfterFirst = await ack<{
      success: boolean;
      data?: {
        correct: boolean;
        view: { gamePhase: string; canSubmitAnswer: boolean };
      };
    }>(host!.socket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, {
      answer: 'إجابة-خاطئة-بعد-المركز-الأول',
      roundId: view.roundId,
    });
    assert.ok(wrongAfterFirst.success);
    assert.equal(wrongAfterFirst.data?.correct, false);
    assert.equal(wrongAfterFirst.data?.view.gamePhase, 'question');
    assert.equal(wrongAfterFirst.data?.view.canSubmitAnswer, true);

    const second = await ack<{
      success: boolean;
      data?: {
        correct: boolean;
        view: {
          gamePhase: string;
          winnerPlayerId: string | null;
          revealedAnswer: string | null;
          correctAnswerPlacement: number | null;
          correctAnswerPoints: number;
          roundResults: Array<{ playerId: string; roundPoints: number; placement: number | null }>;
        };
      };
    }>(host!.socket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, {
      answer,
      roundId: view.roundId,
    });
    assert.ok(second.success);
    assert.equal(second.data?.correct, true);
    assert.equal(second.data?.view.gamePhase, 'round-results');
    assert.equal(second.data?.view.winnerPlayerId, playerB!.id);
    assert.ok(second.data?.view.revealedAnswer);
    assert.equal(second.data?.view.correctAnswerPlacement, 2);
    assert.equal(second.data?.view.correctAnswerPoints, 75);
    assert.deepEqual(
      second.data?.view.roundResults
        .filter((entry) => entry.placement !== null)
        .sort((left, right) => left.placement! - right.placement!)
        .map((entry) => entry.roundPoints),
      [100, 75],
    );

    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  await runTest(
    'near-simultaneous correct answers receive distinct server placements',
    async () => {
      const { clients } = await startFastAnswerMatch(3, 'tech');
      const [host, playerB, playerC] = clients;
      const view = await syncView(host!);
      const answer = answerForQuestion(view.question!);

      const [resultB, resultC] = await Promise.all([
        ack<{
          success: boolean;
          data?: {
            correct: boolean;
            view: { correctAnswerPlacement: number | null; gamePhase: string };
          };
        }>(playerB!.socket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, {
          answer,
          roundId: view.roundId,
        }),
        ack<{
          success: boolean;
          data?: {
            correct: boolean;
            view: { correctAnswerPlacement: number | null; gamePhase: string };
          };
        }>(playerC!.socket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, {
          answer,
          roundId: view.roundId,
        }),
      ]);

      assert.ok(resultB.success && resultB.data?.correct);
      assert.ok(resultC.success && resultC.data?.correct);
      const placements = [
        resultB.data!.view.correctAnswerPlacement,
        resultC.data!.view.correctAnswerPlacement,
      ].sort();
      assert.deepEqual(placements, [1, 2]);

      const syncAfter = await syncView(host!);
      assert.equal(syncAfter.gamePhase, 'question');
      assert.equal(syncAfter.canSubmitAnswer, true);

      const final = await ack<{ success: boolean; data?: { correct: boolean } }>(
        host!.socket,
        FAST_ANSWER_SUBMIT_ANSWER_EVENT,
        { answer, roundId: view.roundId },
      );
      assert.ok(final.success && final.data?.correct);

      const results = await syncView(host!);
      assert.equal(results.gamePhase, 'round-results');
      const placed = results.roundResults
        .filter((entry) => entry.placement !== null)
        .sort((left, right) => left.placement! - right.placement!);
      assert.deepEqual(
        placed.map((entry) => entry.roundPoints),
        [100, 75, 50],
      );
      assert.equal(results.winnerPlayerId, placed[0]!.playerId);

      for (const client of clients) {
        client.socket.disconnect();
      }
    },
  );

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
      data: {
        view: {
          isMatchSpectator: boolean;
          canSubmitAnswer: boolean;
          revealedAnswer: string | null;
          correctAnswerPlacement: number | null;
        };
      };
    }>(spectatorSocket, FAST_ANSWER_SYNC_EVENT);
    assert.ok(spectatorView.success);
    assert.equal(spectatorView.data.view.isMatchSpectator, true);
    assert.equal(spectatorView.data.view.canSubmitAnswer, false);
    assert.equal(spectatorView.data.view.revealedAnswer, null);
    assert.equal(spectatorView.data.view.correctAnswerPlacement, null);

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

  await runTest('reconnect restores a locked placement without duplicate scoring', async () => {
    const { clients } = await startFastAnswerMatch(2, 'food');
    const [host, playerB] = clients;
    const view = await syncView(host!);
    const answer = answerForQuestion(view.question!);

    const first = await ack<{ success: boolean; data?: { correct: boolean } }>(
      playerB!.socket,
      FAST_ANSWER_SUBMIT_ANSWER_EVENT,
      { answer, roundId: view.roundId },
    );
    assert.ok(first.success && first.data?.correct);

    playerB!.socket.disconnect();
    await reconnectClient(playerB!);

    const restored = await syncView(playerB!);
    assert.equal(restored.gamePhase, 'question');
    assert.equal(restored.hasAnsweredCorrectly, true);
    assert.equal(restored.correctAnswerPlacement, 1);
    assert.equal(restored.correctAnswerPoints, 100);
    assert.equal(restored.canSubmitAnswer, false);

    const duplicate = await ack<{ success: boolean }>(
      playerB!.socket,
      FAST_ANSWER_SUBMIT_ANSWER_EVENT,
      { answer, roundId: view.roundId },
    );
    assert.equal(duplicate.success, false);

    const finish = await ack<{ success: boolean; data?: { correct: boolean } }>(
      host!.socket,
      FAST_ANSWER_SUBMIT_ANSWER_EVENT,
      { answer, roundId: view.roundId },
    );
    assert.ok(finish.success && finish.data?.correct);

    const results = await syncView(playerB!);
    assert.equal(results.gamePhase, 'round-results');
    assert.equal(
      results.roundResults.find((entry) => entry.playerId === playerB!.id)?.roundPoints,
      100,
    );

    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  await runTest('host skip results + complete match cleanup allows next game', async () => {
    const { host, clients } = await startFastAnswerMatch(2, 'games');

    for (let round = 1; round <= FAST_ANSWER_DEFAULT_ROUNDS; round += 1) {
      const view = await waitFor(
        async () => {
          const current = await syncView(host);
          return current.gamePhase === 'question' && current.currentRound === round
            ? current
            : null;
        },
        20000,
        `question round ${round}`,
      );

      assert.equal(view.categoryId, 'games');
      assert.equal(view.totalRounds, 5);
      assert.ok(view.roundId);

      await submitCorrectForAll(clients, view);

      const after = await waitFor(
        async () => {
          const current = await syncView(host);
          if (current.gamePhase === 'round-results' && current.currentRound === round) {
            return current;
          }
          if (
            round < FAST_ANSWER_DEFAULT_ROUNDS &&
            current.gamePhase === 'question' &&
            current.currentRound === round + 1
          ) {
            return current;
          }
          if (round === FAST_ANSWER_DEFAULT_ROUNDS && current.gamePhase === 'match-completed') {
            return current;
          }
          return null;
        },
        10000,
        `post-win round ${round}`,
      );

      if (after.gamePhase === 'round-results') {
        const cont = await ack<{ success: boolean; error?: { message?: string } }>(
          host.socket,
          FAST_ANSWER_CONTINUE_ROUND_RESULTS_EVENT,
        );
        assert.ok(cont.success, `continue round ${round}: ${cont.error?.message ?? 'failed'}`);
      }
    }

    const finalOrLobby = await waitFor(
      async () => {
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
      },
      20000,
      'final or lobby',
    );

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

  await runTest('random match keeps عشوائي publicly across rounds', async () => {
    const { host, clients } = await startFastAnswerMatch(2, 'random');
    const seenInternal: string[] = [];

    for (let round = 1; round <= FAST_ANSWER_DEFAULT_ROUNDS; round += 1) {
      const view = await waitFor(
        async () => {
          const current = await syncView(host);
          return current.gamePhase === 'question' && current.currentRound === round
            ? current
            : null;
        },
        20000,
        `random question round ${round}`,
      );

      assert.equal(view.categoryId, 'random');
      assert.equal(view.categoryLabel, 'عشوائي');
      const entry = contentQuestions.find((item) => item.question === view.question);
      assert.ok(entry);
      seenInternal.push(entry!.categoryId);

      await submitCorrectForAll(clients, view);

      const after = await waitFor(
        async () => {
          const current = await syncView(host);
          if (current.gamePhase === 'round-results' && current.currentRound === round) {
            return current;
          }
          if (
            round < FAST_ANSWER_DEFAULT_ROUNDS &&
            current.gamePhase === 'question' &&
            current.currentRound === round + 1
          ) {
            return current;
          }
          if (round === FAST_ANSWER_DEFAULT_ROUNDS && current.gamePhase === 'match-completed') {
            return current;
          }
          return null;
        },
        10000,
        `random post-win ${round}`,
      );

      assert.equal(after.categoryId, 'random');
      assert.equal(after.categoryLabel, 'عشوائي');

      if (after.gamePhase === 'round-results') {
        const cont = await ack<{ success: boolean }>(
          host.socket,
          FAST_ANSWER_CONTINUE_ROUND_RESULTS_EVENT,
        );
        assert.ok(cont.success);
      }
    }

    assert.equal(seenInternal.length, 5);
    assert.equal(new Set(seenInternal).size, 5, 'prefer unique categories across 5 rounds');

    const maybeFinal = await syncView(host).catch(() => null);
    if (maybeFinal?.gamePhase === 'match-completed') {
      await ack(host.socket, FAST_ANSWER_CONTINUE_ROUND_RESULTS_EVENT);
    }

    for (const client of clients) {
      client.socket.disconnect();
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
