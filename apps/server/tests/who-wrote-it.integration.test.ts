/**
 * Who Wrote It Socket.IO — P4.6 production polish.
 * Requires server on localhost:4001 with WANASATNA_TEST_MODE=1.
 *
 * Run: pnpm --filter @wanasatna/server test:who-wrote-it:integration
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RECONNECT_EVENT,
  TIMING_CHALLENGE_GAME_ID,
  WHO_WROTE_IT_CONTINUE_ROUND_RESULTS_EVENT,
  WHO_WROTE_IT_DEFAULT_ROUNDS,
  WHO_WROTE_IT_GAME_ID,
  WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
  WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
  WHO_WROTE_IT_SYNC_EVENT,
} from '@wanasatna/shared';
import {
  ack,
  connectClient,
  PLAYER_NAMES,
  trackClientEvents,
  waitFor,
  waitForServer,
  type TestClient,
} from './helpers/socket-utils.js';

let passed = 0;
let failed = 0;

type ContentPrompt = {
  text: string;
  categoryId: string;
};

const contentPrompts = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../content/who-wrote-it/words.json'),
    'utf8',
  ),
) as ContentPrompt[];

function categoryForQuestion(question: string): string {
  const entry = contentPrompts.find((item) => item.text === question);
  assert.ok(entry, `missing content for prompt: ${question}`);
  return entry.categoryId;
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

type SyncView = {
  gamePhase: string;
  roundId: string | null;
  question: string | null;
  categoryId: string | null;
  categoryLabel: string | null;
  currentRound: number;
  totalRounds: number;
  canSubmitAnswer: boolean;
  hasSubmittedAnswer: boolean;
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
  isMatchSpectator: boolean;
  roundResultsContinueLabel: string | null;
  roundResultsWaitingMessage: string | null;
};

async function syncView(client: TestClient): Promise<SyncView> {
  const syncRes = await ack<{ success: boolean; data: { view: SyncView } }>(
    client.socket,
    WHO_WROTE_IT_SYNC_EVENT,
  );
  assert.ok(syncRes.success);
  return syncRes.data.view;
}

async function createRoomWithPlayers(playerCount: number): Promise<{
  host: TestClient;
  clients: TestClient[];
}> {
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

  return { host, clients };
}

async function startWhoWroteItMatch(
  playerCount = 4,
  categoryId: string | null = 'funny-situations',
): Promise<{
  host: TestClient;
  clients: TestClient[];
}> {
  const { host, clients } = await createRoomWithPlayers(playerCount);

  const startRes = await ack<{ success: boolean; error?: { message?: string } }>(
    host.socket,
    'game-shell-start-from-lobby',
    { gameId: WHO_WROTE_IT_GAME_ID, categoryId },
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

async function submitAllAnswers(clients: TestClient[], roundId: string): Promise<void> {
  for (const client of clients) {
    const submitRes = await ack<{ success: boolean; error?: { message?: string } }>(
      client.socket,
      WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
      { answer: `إجابة ${client.name}`, roundId },
    );
    assert.ok(submitRes.success, submitRes.error?.message ?? 'answer failed');
  }
}

async function finishGuessing(clients: TestClient[]): Promise<SyncView> {
  for (let step = 0; step < 16; step += 1) {
    const views = await Promise.all(clients.map((client) => syncView(client)));
    if (views[0]!.gamePhase === 'round-results') {
      return views[0]!;
    }

    const currentId = views[0]!.currentAnonymousAnswer?.answerId;
    const roundId = views[0]!.roundId;
    assert.ok(currentId);
    assert.ok(roundId);

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
        { answerId: currentId, ownerPlayerId: option.playerId, roundId },
      );
      assert.ok(res.success, res.error?.message ?? 'guess failed');
    }
  }

  return waitFor(async () => {
    const view = await syncView(clients[0]!);
    return view.gamePhase === 'round-results' ? view : null;
  }, 15000, 'round-results after guesses');
}

function disconnectAll(clients: TestClient[]): void {
  for (const client of clients) {
    client.socket.disconnect();
  }
}

async function main(): Promise<void> {
  console.log('[who-wrote-it] waiting for test server...');
  await waitForServer();

  await runTest('3 players start with exactly 3 rounds', async () => {
    const { host, clients } = await startWhoWroteItMatch(3, 'funny-situations');
    const view = await syncView(host);
    assert.equal(view.gamePhase, 'answering');
    assert.equal(view.totalRounds, WHO_WROTE_IT_DEFAULT_ROUNDS);
    assert.equal(view.currentRound, 1);
    assert.ok(view.roundId);
    disconnectAll(clients);
  });

  await runTest('8 players start', async () => {
    const { host, clients } = await startWhoWroteItMatch(8, 'funny-situations');
    const view = await syncView(host);
    assert.equal(view.gamePhase, 'answering');
    assert.equal(view.totalRounds, 3);
    disconnectAll(clients);
  });

  await runTest('global guessing: sync advance + reconnect + reveal', async () => {
    const { clients } = await startWhoWroteItMatch(4, 'funny-situations');
    const [host, playerB, playerC, playerD] = clients;
    assert.ok(host && playerB && playerC && playerD);

    const opening = await syncView(host);
    await submitAllAnswers(clients, opening.roundId!);

    await waitFor(async () => {
      const view = await syncView(host);
      return view.gamePhase === 'guessing' ? view : null;
    }, 10000, 'guessing phase');

    const firstViews = await Promise.all(clients.map((client) => syncView(client)));
    const firstAnswerId = firstViews[0]!.currentAnonymousAnswer?.answerId;
    const roundId = firstViews[0]!.roundId;
    assert.ok(firstAnswerId);
    assert.ok(roundId);
    assert.ok(
      firstViews.every((view) => view.currentAnonymousAnswer?.answerId === firstAnswerId),
    );
    assert.equal(firstViews[0]!.guessingProgressIndex, 1);
    assert.equal(firstViews[0]!.guessingProgressTotal, 4);
    assert.equal(JSON.stringify(firstViews[0]!.currentAnonymousAnswer).includes('ownerPlayerId'), false);

    const ownerClient = clients.find((client, index) => firstViews[index]!.isOwnAnswer);
    assert.ok(ownerClient, 'exactly one owner for current answer');
    const ownerView = await syncView(ownerClient);
    assert.equal(ownerView.isOwnAnswer, true);
    assert.equal(ownerView.canSubmitGuess, false);

    const ownerGuessAttempt = await ack<{ success: boolean }>(
      ownerClient.socket,
      WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
      { answerId: firstAnswerId, ownerPlayerId: host.id, roundId },
    );
    assert.equal(ownerGuessAttempt.success, false);

    const guessers = clients.filter((client) => client.id !== ownerClient.id);
    const g0 = guessers[0]!;
    const g0View = await syncView(g0);
    const option0 = g0View.guessOptions[0]!;

    const guess0 = await ack<{ success: boolean }>(
      g0.socket,
      WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
      { answerId: firstAnswerId, ownerPlayerId: option0.playerId, roundId },
    );
    assert.ok(guess0.success);

    const duplicate = await ack<{ success: boolean }>(
      g0.socket,
      WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
      { answerId: firstAnswerId, ownerPlayerId: option0.playerId, roundId },
    );
    assert.equal(duplicate.success, false);

    const afterOne = await Promise.all(clients.map((client) => syncView(client)));
    assert.ok(
      afterOne.every((view) => view.currentAnonymousAnswer?.answerId === firstAnswerId),
    );

    const g1 = guessers[1]!;
    const g1View = await syncView(g1);
    const guess1 = await ack<{ success: boolean }>(
      g1.socket,
      WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
      { answerId: firstAnswerId, ownerPlayerId: g1View.guessOptions[0]!.playerId, roundId },
    );
    assert.ok(guess1.success);

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
    assert.equal(JSON.stringify(afterReconnect).includes('"ownerPlayerId"'), false);

    const g2 = guessers[2]!;
    const g2View = await syncView(g2);
    const guess2 = await ack<{ success: boolean }>(
      g2.socket,
      WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
      { answerId: firstAnswerId, ownerPlayerId: g2View.guessOptions[0]!.playerId, roundId },
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

    const afterAdvance = await syncView(host);
    if (afterAdvance.gamePhase === 'guessing' && afterAdvance.currentAnonymousAnswer) {
      const staleAnswerId = await ack<{ success: boolean }>(
        guessers[0]!.socket,
        WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
        {
          answerId: firstAnswerId,
          ownerPlayerId: host.id,
          roundId: afterAdvance.roundId,
        },
      );
      assert.equal(staleAnswerId.success, false);
    }

    await finishGuessing(clients);

    const reveals = await Promise.all(clients.map((client) => syncView(client)));
    for (const view of reveals) {
      assert.equal(view.gamePhase, 'round-results');
      assert.equal(view.revealEntries.length, 4);
    }

    disconnectAll(clients);
  });

  await runTest('stale roundId and answer-id guesses rejected', async () => {
    const { host, clients } = await startWhoWroteItMatch(3, 'funny-situations');
    const opening = await syncView(host);
    const staleRoundId = 'stale-round';

    const staleAnswer = await ack<{ success: boolean }>(
      host.socket,
      WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
      { answer: 'إجابة قديمة', roundId: staleRoundId },
    );
    assert.equal(staleAnswer.success, false);

    await submitAllAnswers(clients, opening.roundId!);
    const guessing = await waitFor(async () => {
      const view = await syncView(host);
      return view.gamePhase === 'guessing' ? view : null;
    }, 10000, 'guessing for stale test');

    const firstId = guessing.currentAnonymousAnswer?.answerId;
    assert.ok(firstId);

    const staleGuessRound = await ack<{ success: boolean }>(
      clients[1]!.socket,
      WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
      {
        answerId: firstId,
        ownerPlayerId: host.id,
        roundId: staleRoundId,
      },
    );
    assert.equal(staleGuessRound.success, false);

    const afterAdvance = await finishGuessing(clients);
    const staleAnswerId = await ack<{ success: boolean }>(
      clients[1]!.socket,
      WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
      {
        answerId: firstId,
        ownerPlayerId: host.id,
        roundId: afterAdvance.roundId ?? opening.roundId,
      },
    );
    assert.equal(staleAnswerId.success, false);

    disconnectAll(clients);
  });

  await runTest('empty/oversize/duplicate answers rejected', async () => {
    const { host, clients } = await startWhoWroteItMatch(3, 'funny-situations');
    const view = await syncView(host);

    const empty = await ack<{ success: boolean }>(
      host.socket,
      WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
      { answer: '   ', roundId: view.roundId },
    );
    assert.equal(empty.success, false);

    const tooLong = await ack<{ success: boolean }>(
      host.socket,
      WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
      { answer: 'ا'.repeat(151), roundId: view.roundId },
    );
    assert.equal(tooLong.success, false);

    const ok = await ack<{ success: boolean }>(
      host.socket,
      WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
      { answer: 'إجابة صحيحة', roundId: view.roundId },
    );
    assert.ok(ok.success);

    const dup = await ack<{ success: boolean }>(
      host.socket,
      WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
      { answer: 'إجابة ثانية', roundId: view.roundId },
    );
    assert.equal(dup.success, false);

    disconnectAll(clients);
  });

  await runTest('AFK answering timeout does not stall', async () => {
    const { host, clients } = await startWhoWroteItMatch(3, 'funny-situations');
    const after = await waitFor(async () => {
      const view = await syncView(host);
      return view.gamePhase === 'round-results' || view.gamePhase === 'guessing' ? view : null;
    }, 25000, 'answering timeout advance');
    assert.ok(after.gamePhase === 'round-results' || after.gamePhase === 'guessing');
    disconnectAll(clients);
  });

  await runTest('AFK guess timeout does not stall', async () => {
    const { host, clients } = await startWhoWroteItMatch(3, 'funny-situations');
    const opening = await syncView(host);
    await submitAllAnswers(clients, opening.roundId!);
    await waitFor(async () => {
      const view = await syncView(host);
      return view.gamePhase === 'guessing' ? view : null;
    }, 10000, 'guessing before AFK timeout');

    const results = await waitFor(async () => {
      const view = await syncView(host);
      return view.gamePhase === 'round-results' ? view : null;
    }, 60000, 'guessing timeout to results');
    assert.equal(results.gamePhase, 'round-results');
    disconnectAll(clients);
  });

  await runTest('fixed category stays for all 3 rounds; random stays عشوائي', async () => {
    const { host, clients } = await startWhoWroteItMatch(3, 'funny-situations');

    for (let round = 1; round <= WHO_WROTE_IT_DEFAULT_ROUNDS; round += 1) {
      const view = await waitFor(async () => {
        const current = await syncView(host);
        return current.gamePhase === 'answering' && current.currentRound === round
          ? current
          : null;
      }, 20000, `funny answering round ${round}`);

      assert.equal(view.totalRounds, 3);
      assert.equal(view.categoryId, 'funny-situations');
      assert.equal(view.categoryLabel, 'مواقف مضحكة');
      assert.equal(categoryForQuestion(view.question!), 'funny-situations');

      await submitAllAnswers(clients, view.roundId!);
      const results = await finishGuessing(clients);
      assert.equal(results.categoryLabel, 'مواقف مضحكة');
      assert.equal(
        results.roundResultsWaitingMessage,
        round < 3 ? 'الجولة التالية تبدأ تلقائياً...' : 'سيتم عرض النتائج النهائية تلقائياً...',
      );

      const cont = await ack<{ success: boolean; error?: { message?: string } }>(
        host.socket,
        WHO_WROTE_IT_CONTINUE_ROUND_RESULTS_EVENT,
      );
      assert.ok(cont.success, cont.error?.message ?? `continue round ${round}`);
    }

    disconnectAll(clients);
  });

  await runTest('random match keeps عشوائي publicly and prefers unique categories', async () => {
    const { host, clients } = await startWhoWroteItMatch(3, 'random');
    const seenInternal: string[] = [];

    for (let round = 1; round <= WHO_WROTE_IT_DEFAULT_ROUNDS; round += 1) {
      const view = await waitFor(async () => {
        const current = await syncView(host);
        return current.gamePhase === 'answering' && current.currentRound === round
          ? current
          : null;
      }, 20000, `random answering round ${round}`);

      assert.equal(view.categoryId, 'random');
      assert.equal(view.categoryLabel, 'عشوائي');
      seenInternal.push(categoryForQuestion(view.question!));

      await submitAllAnswers(clients, view.roundId!);
      const results = await finishGuessing(clients);
      assert.equal(results.categoryId, 'random');
      assert.equal(results.categoryLabel, 'عشوائي');

      const cont = await ack<{ success: boolean }>(
        host.socket,
        WHO_WROTE_IT_CONTINUE_ROUND_RESULTS_EVENT,
      );
      assert.ok(cont.success);
    }

    assert.equal(seenInternal.length, 3);
    assert.equal(new Set(seenInternal).size, 3, 'prefer unique categories across 3 rounds');
    disconnectAll(clients);
  });

  await runTest('spectator mid-join cannot submit and does not see owners', async () => {
    const { host, clients } = await startWhoWroteItMatch(3, 'funny-situations');
    const view = await syncView(host);

    const spectatorSocket = await connectClient();
    const joinRes = await ack<{ success: boolean; data: { player: { id: string } } }>(
      spectatorSocket,
      'join-room',
      { roomCode: host.roomCode, playerName: 'مشاهد' },
    );
    assert.ok(joinRes.success);

    const spectatorView = await ack<{
      success: boolean;
      data: { view: SyncView };
    }>(spectatorSocket, WHO_WROTE_IT_SYNC_EVENT);
    assert.ok(spectatorView.success);
    assert.equal(spectatorView.data.view.isMatchSpectator, true);
    assert.equal(spectatorView.data.view.canSubmitAnswer, false);
    assert.equal(spectatorView.data.view.canSubmitGuess, false);
    assert.equal(JSON.stringify(spectatorView.data.view).includes('"ownerPlayerId"'), false);

    const submit = await ack<{ success: boolean }>(
      spectatorSocket,
      WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
      { answer: 'إجابة مشاهد', roundId: view.roundId },
    );
    assert.equal(submit.success, false);

    spectatorSocket.disconnect();
    disconnectAll(clients);
  });

  await runTest('3 rounds then final lobby cleanup allows Game B', async () => {
    const { host, clients } = await startWhoWroteItMatch(3, 'funny-situations');

    for (let round = 1; round <= WHO_WROTE_IT_DEFAULT_ROUNDS; round += 1) {
      const view = await waitFor(async () => {
        const current = await syncView(host);
        return current.gamePhase === 'answering' && current.currentRound === round
          ? current
          : null;
      }, 20000, `cleanup answering round ${round}`);

      await submitAllAnswers(clients, view.roundId!);
      await finishGuessing(clients);
      const cont = await ack<{ success: boolean; error?: { message?: string } }>(
        host.socket,
        WHO_WROTE_IT_CONTINUE_ROUND_RESULTS_EVENT,
      );
      assert.ok(cont.success, cont.error?.message ?? `continue ${round}`);
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
        WHO_WROTE_IT_CONTINUE_ROUND_RESULTS_EVENT,
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

    disconnectAll(clients);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
