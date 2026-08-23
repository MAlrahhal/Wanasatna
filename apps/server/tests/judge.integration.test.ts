/**
 * Judge Socket.IO multiplayer — P4.7 production polish.
 * Requires server on localhost:4001 with WANASATNA_TEST_MODE=1.
 *
 * Run: pnpm --filter @wanasatna/server test:judge:integration
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  JUDGE_CONTINUE_ROUND_RESULTS_EVENT,
  JUDGE_GAME_ID,
  JUDGE_SELECT_WINNER_EVENT,
  JUDGE_SUBMIT_ANSWER_EVENT,
  JUDGE_SYNC_EVENT,
  RECONNECT_EVENT,
  TIMING_CHALLENGE_GAME_ID,
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
    join(dirname(fileURLToPath(import.meta.url)), '../../../content/judge/words.json'),
    'utf8',
  ),
) as ContentPrompt[];

function categoryForPrompt(prompt: string): string {
  const entry = contentPrompts.find((item) => item.text === prompt);
  assert.ok(entry, `missing content for prompt: ${prompt}`);
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
  prompt: string | null;
  categoryId: string | null;
  categoryLabel: string | null;
  currentRound: number;
  totalRounds: number;
  isJudge: boolean;
  judgePlayerId: string | null;
  canSubmitAnswer: boolean;
  canSelectWinner: boolean;
  hasSubmittedAnswer: boolean;
  anonymousAnswers: Array<{ answerId: string; text: string }>;
  winningAnswerText: string | null;
  winnerName: string | null;
  revealEntries: Array<{ answerId: string; ownerPlayerId: string; text: string; isWinner: boolean }>;
  roundResults: Array<{ playerId: string; roundPoints: number }>;
  isMatchSpectator: boolean;
  roundResultsContinueLabel: string | null;
  roundResultsWaitingMessage: string | null;
};

async function syncView(client: TestClient): Promise<SyncView> {
  const syncRes = await ack<{ success: boolean; data: { view: SyncView } }>(
    client.socket,
    JUDGE_SYNC_EVENT,
  );
  assert.ok(syncRes.success);
  return syncRes.data.view;
}

function disconnectAll(clients: TestClient[]): void {
  for (const client of clients) {
    client.socket.disconnect();
  }
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

async function startJudgeMatch(
  playerCount = 4,
  categoryId: string | null = 'worst-answer',
): Promise<{
  host: TestClient;
  clients: TestClient[];
}> {
  const { host, clients } = await createRoomWithPlayers(playerCount);

  const startRes = await ack<{ success: boolean; error?: { message?: string } }>(
    host.socket,
    'game-shell-start-from-lobby',
    { gameId: JUDGE_GAME_ID, categoryId },
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

async function submitAllAnswers(clients: TestClient[], roundId: string, judgeId: string): Promise<void> {
  for (const client of clients) {
    if (client.id === judgeId) {
      continue;
    }
    const res = await ack<{ success: boolean; error?: { message?: string } }>(
      client.socket,
      JUDGE_SUBMIT_ANSWER_EVENT,
      { answer: `إجابة ${client.name}`, roundId },
    );
    assert.ok(res.success, res.error?.message ?? `answer failed for ${client.name}`);
  }
}

async function playCurrentRound(
  host: TestClient,
  clients: TestClient[],
  selectWinner: boolean,
): Promise<{ judgeId: string; roundId: string; phaseAfter: string }> {
  const answering = await waitFor(async () => {
    const view = await syncView(host);
    return view.gamePhase === 'answering' ? view : null;
  }, 15000, 'answering');

  assert.ok(answering.judgePlayerId);
  assert.ok(answering.roundId);
  await submitAllAnswers(clients, answering.roundId, answering.judgePlayerId);

  const judging = await waitFor(async () => {
    const view = await syncView(host);
    return view.gamePhase === 'judging' ? view : null;
  }, 15000, 'judging');

  const judgeClient = clients.find((client) => client.id === answering.judgePlayerId);
  assert.ok(judgeClient);

  if (selectWinner && judging.anonymousAnswers[0]) {
    const selectRes = await ack<{ success: boolean; error?: { message?: string } }>(
      judgeClient.socket,
      JUDGE_SELECT_WINNER_EVENT,
      { answerId: judging.anonymousAnswers[0].answerId, roundId: judging.roundId },
    );
    assert.ok(selectRes.success, selectRes.error?.message ?? 'select failed');
  }

  const after = await waitFor(async () => {
    const view = await syncView(host);
    return view.gamePhase === 'round-results' || view.gamePhase === 'match-completed'
      ? view
      : null;
  }, 20000, 'results or final');

  if (after.gamePhase === 'round-results') {
    const cont = await ack<{ success: boolean; error?: { message?: string } }>(
      host.socket,
      JUDGE_CONTINUE_ROUND_RESULTS_EVENT,
    );
    assert.ok(cont.success, cont.error?.message ?? 'continue failed');
  }

  return {
    judgeId: answering.judgePlayerId,
    roundId: answering.roundId,
    phaseAfter: after.gamePhase,
  };
}

async function main(): Promise<void> {
  console.log('[judge] waiting for test server...');
  await waitForServer();

  await runTest('3 players → 3 unique judges then cleanup allows Game B', async () => {
    const { host, clients } = await startJudgeMatch(3, 'worst-answer');
    const startView = await syncView(host);
    assert.equal(startView.totalRounds, 3);
    assert.equal(startView.categoryLabel, 'مواقف مضحكة');

    const judges: string[] = [];
    for (let round = 1; round <= 3; round += 1) {
      const played = await playCurrentRound(host, clients, true);
      judges.push(played.judgeId);
    }

    assert.equal(judges.length, 3);
    assert.equal(new Set(judges).size, 3);

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
        JUDGE_CONTINUE_ROUND_RESULTS_EVENT,
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

  await runTest('8 players → 8 unique judges', async () => {
    const { host, clients } = await startJudgeMatch(8, 'worst-answer');
    const startView = await syncView(host);
    assert.equal(startView.totalRounds, 8);

    const judges: string[] = [];
    for (let round = 1; round <= 8; round += 1) {
      const played = await playCurrentRound(host, clients, true);
      judges.push(played.judgeId);
    }

    assert.equal(new Set(judges).size, 8);
    disconnectAll(clients);
  });

  await runTest('fixed category stays locked; random stays public عشوائي', async () => {
    const fixed = await startJudgeMatch(3, 'worst-answer');
    const first = await syncView(fixed.host);
    assert.equal(first.categoryLabel, 'مواقف مضحكة');
    assert.equal(categoryForPrompt(first.prompt ?? ''), 'worst-answer');
    await playCurrentRound(fixed.host, fixed.clients, true);
    const second = await waitFor(async () => {
      const view = await syncView(fixed.host);
      return view.gamePhase === 'answering' && view.currentRound === 2 ? view : null;
    }, 15000, 'round 2 answering');
    assert.equal(second.categoryLabel, 'مواقف مضحكة');
    assert.equal(categoryForPrompt(second.prompt ?? ''), 'worst-answer');
    disconnectAll(fixed.clients);

    const randomMatch = await startJudgeMatch(3, 'random');
    const randomView = await syncView(randomMatch.host);
    assert.equal(randomView.categoryId, 'random');
    assert.equal(randomView.categoryLabel, 'عشوائي');
    disconnectAll(randomMatch.clients);
  });

  await runTest('stale roundId rejected for answer and judge select', async () => {
    const { host, clients } = await startJudgeMatch(3, 'worst-answer');
    const first = await syncView(host);
    const staleRoundId = first.roundId!;
    const firstPlayed = await playCurrentRound(host, clients, true);

    const second = await waitFor(async () => {
      const view = await syncView(host);
      return view.gamePhase === 'answering' && view.roundId !== firstPlayed.roundId ? view : null;
    }, 15000, 'round 2');

    const answerer = clients.find((client) => client.id !== second.judgePlayerId)!;
    const staleAnswer = await ack<{ success: boolean }>(
      answerer.socket,
      JUDGE_SUBMIT_ANSWER_EVENT,
      { answer: 'متأخرة', roundId: staleRoundId },
    );
    assert.equal(staleAnswer.success, false);

    await submitAllAnswers(clients, second.roundId!, second.judgePlayerId!);
    const judging = await waitFor(async () => {
      const view = await syncView(host);
      return view.gamePhase === 'judging' ? view : null;
    }, 15000, 'judging');

    const judgeClient = clients.find((client) => client.id === second.judgePlayerId)!;
    const staleSelect = await ack<{ success: boolean }>(
      judgeClient.socket,
      JUDGE_SELECT_WINNER_EVENT,
      { answerId: judging.anonymousAnswers[0]!.answerId, roundId: staleRoundId },
    );
    assert.equal(staleSelect.success, false);

    disconnectAll(clients);
  });

  await runTest('judge cannot submit; empty rejected; duplicate submit rejected', async () => {
    const { host, clients } = await startJudgeMatch(3, 'worst-answer');
    const view = await syncView(host);
    const judgeClient = clients.find((client) => client.id === view.judgePlayerId)!;
    const answerer = clients.find((client) => client.id !== view.judgePlayerId)!;

    const judgeSubmit = await ack<{ success: boolean }>(
      judgeClient.socket,
      JUDGE_SUBMIT_ANSWER_EVENT,
      { answer: 'لا يجب', roundId: view.roundId },
    );
    assert.equal(judgeSubmit.success, false);

    const empty = await ack<{ success: boolean }>(
      answerer.socket,
      JUDGE_SUBMIT_ANSWER_EVENT,
      { answer: '   ', roundId: view.roundId },
    );
    assert.equal(empty.success, false);

    const first = await ack<{ success: boolean }>(
      answerer.socket,
      JUDGE_SUBMIT_ANSWER_EVENT,
      { answer: 'إجابة', roundId: view.roundId },
    );
    assert.ok(first.success);

    const dup = await ack<{ success: boolean }>(
      answerer.socket,
      JUDGE_SUBMIT_ANSWER_EVENT,
      { answer: 'إجابة أخرى', roundId: view.roundId },
    );
    assert.equal(dup.success, false);

    disconnectAll(clients);
  });

  await runTest('privacy + reconnect + spectator do not leak owners during judging', async () => {
    const { host, clients } = await startJudgeMatch(4, 'worst-answer');
    const answering = await syncView(host);
    await submitAllAnswers(clients, answering.roundId!, answering.judgePlayerId!);

    const judging = await waitFor(async () => {
      const view = await syncView(host);
      return view.gamePhase === 'judging' ? view : null;
    }, 15000, 'judging');

    for (const client of clients) {
      const view = await syncView(client);
      assert.equal(JSON.stringify(view).includes('ownerPlayerId'), false);
      assert.ok(view.anonymousAnswers.every((answer) => !('ownerPlayerId' in answer)));
    }

    const judgeClient = clients.find((client) => client.id === answering.judgePlayerId)!;
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
    assert.equal(afterReconnect.canSelectWinner, true);
    assert.equal(JSON.stringify(afterReconnect).includes('ownerPlayerId'), false);

    const spectatorSocket = await connectClient();
    const joinRes = await ack<{ success: boolean }>(spectatorSocket, 'join-room', {
      roomCode: host.roomCode,
      playerName: 'مشاهد',
    });
    assert.ok(joinRes.success);
    const spectatorView = await ack<{ success: boolean; data: { view: SyncView } }>(
      spectatorSocket,
      JUDGE_SYNC_EVENT,
    );
    assert.ok(spectatorView.success);
    assert.equal(spectatorView.data.view.isMatchSpectator, true);
    assert.equal(spectatorView.data.view.canSubmitAnswer, false);
    assert.equal(spectatorView.data.view.canSelectWinner, false);
    assert.equal(JSON.stringify(spectatorView.data.view).includes('ownerPlayerId'), false);

    const spectatorSubmit = await ack<{ success: boolean }>(
      spectatorSocket,
      JUDGE_SUBMIT_ANSWER_EVENT,
      { answer: 'إجابة مشاهد', roundId: judging.roundId },
    );
    assert.equal(spectatorSubmit.success, false);

    spectatorSocket.disconnect();
    disconnectAll(clients);
  });

  await runTest('judge timeout awards no winner points', async () => {
    const { host, clients } = await startJudgeMatch(3, 'worst-answer');
    const answering = await syncView(host);
    await submitAllAnswers(clients, answering.roundId!, answering.judgePlayerId!);

    await waitFor(async () => {
      const view = await syncView(host);
      return view.gamePhase === 'judging' ? view : null;
    }, 15000, 'judging');

    const results = await waitFor(async () => {
      const view = await syncView(host);
      return view.gamePhase === 'round-results' ? view : null;
    }, 20000, 'timeout results');

    assert.equal(results.winningAnswerText, null);
    assert.ok(results.roundResults.every((entry) => entry.roundPoints === 0));
    disconnectAll(clients);
  });

  await runTest('all-submit advances early; host continue copy on non-final', async () => {
    const { host, clients } = await startJudgeMatch(3, 'worst-answer');
    const answering = await syncView(host);
    const started = Date.now();
    await submitAllAnswers(clients, answering.roundId!, answering.judgePlayerId!);
    await waitFor(async () => {
      const view = await syncView(host);
      return view.gamePhase === 'judging' ? view : null;
    }, 8000, 'early judging');
    assert.ok(Date.now() - started < 8000);

    const judgeClient = clients.find((client) => client.id === answering.judgePlayerId)!;
    const judging = await syncView(judgeClient);
    const selectRes = await ack<{ success: boolean }>(
      judgeClient.socket,
      JUDGE_SELECT_WINNER_EVENT,
      { answerId: judging.anonymousAnswers[0]!.answerId, roundId: judging.roundId },
    );
    assert.ok(selectRes.success);

    const results = await waitFor(async () => {
      const view = await syncView(host);
      return view.gamePhase === 'round-results' ? view : null;
    }, 10000, 'round-results');
    assert.equal(results.roundResultsWaitingMessage, 'الجولة التالية تبدأ تلقائياً...');
    assert.equal(results.roundResultsContinueLabel, 'التالي الآن');
    const winner = results.roundResults.find((entry) => entry.roundPoints === 100);
    assert.ok(winner);
    assert.notEqual(winner.playerId, answering.judgePlayerId);

    disconnectAll(clients);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
