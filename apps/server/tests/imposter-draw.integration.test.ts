/**
 * Imposter Draw Socket.IO multiplayer integration (P4.3).
 * Requires server on localhost:4001 with WANASATNA_TEST_MODE=1.
 *
 * Run: pnpm --filter @wanasatna/server test:imposter-draw:integration
 */
import assert from 'node:assert/strict';
import type { ImposterDrawPlayerView } from '@wanasatna/shared';
import {
  IMPOSTER_DRAW_CONTINUE_ROUND_RESULTS_EVENT,
  IMPOSTER_DRAW_GAME_ID,
  IMPOSTER_DRAW_STROKE_EVENT,
  IMPOSTER_DRAW_SUBMIT_IMAGE_GUESS_EVENT,
  IMPOSTER_DRAW_SUBMIT_ROLE_UNDERSTOOD_EVENT,
  IMPOSTER_DRAW_SUBMIT_VOTE_EVENT,
  IMPOSTER_DRAW_SYNC_EVENT,
  IMPOSTER_DRAW_UNDO_EVENT,
  IMPOSTER_DRAW_TURN_SECONDS,
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

async function syncView(socket: TestClient['socket']): Promise<ImposterDrawPlayerView> {
  const res = await ack<{
    success: boolean;
    data?: { view: ImposterDrawPlayerView };
    error?: { code: string; message: string };
  }>(socket, IMPOSTER_DRAW_SYNC_EVENT, {});
  if (!res.success || !res.data?.view) {
    throw new Error(
      `imposter-draw sync failed: ${res.error?.code ?? 'UNKNOWN'} ${res.error?.message ?? ''}`,
    );
  }
  return res.data.view;
}

async function createRoomWithPlayers(playerCount: number): Promise<TestClient[]> {
  assert.ok(playerCount >= 3 && playerCount <= 8);
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

async function startImposterDraw(clients: TestClient[]): Promise<void> {
  const host = clients[0]!;
  const startRes = await ack<{ success: boolean; error?: { message?: string } }>(
    host.socket,
    'game-shell-start-from-lobby',
    { gameId: IMPOSTER_DRAW_GAME_ID },
  );
  assert.ok(startRes.success, startRes.error?.message ?? 'start failed');

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
    const view = await syncView(host.socket);
    return view.gamePhase === 'briefing' ? view : null;
  }, 15000, 'briefing phase');
}

async function disconnectAll(clients: TestClient[]): Promise<void> {
  for (const client of clients) {
    client.socket.disconnect();
  }
  await sleep(50);
}

function sampleStroke(turnId: string, strokeId: string) {
  return {
    turnId,
    strokeId,
    tool: 'draw' as const,
    color: '#111827',
    size: 4,
    points: [
      { x: 0.2, y: 0.3 },
      { x: 0.25, y: 0.35 },
    ],
  };
}

async function acknowledgeBriefing(clients: TestClient[]): Promise<ImposterDrawPlayerView> {
  for (const client of clients) {
    const res = await ack<{ success: boolean; error?: { message?: string } }>(
      client.socket,
      IMPOSTER_DRAW_SUBMIT_ROLE_UNDERSTOOD_EVENT,
      {},
    );
    assert.ok(res.success, res.error?.message ?? 'ack briefing');
  }

  return waitFor(async () => {
    const view = await syncView(clients[0]!.socket);
    return view.gamePhase === 'drawing-turns' ? view : null;
  }, 10000, 'drawing after briefing ack');
}

async function waitForPhase(
  host: TestClient,
  phase: ImposterDrawPlayerView['gamePhase'],
  label: string,
  timeoutMs = 30000,
): Promise<ImposterDrawPlayerView> {
  return waitFor(async () => {
    const view = await syncView(host.socket);
    return view.gamePhase === phase ? view : null;
  }, timeoutMs, label);
}

async function playThroughDrawing(
  clients: TestClient[],
  initialView: ImposterDrawPlayerView,
): Promise<string[]> {
  const host = clients[0]!;
  const drawers: string[] = [];
  let previousTurnId: string | null = null;
  let view = initialView;

  while (view.gamePhase === 'drawing-turns') {

    const drawerId = view.currentDrawerPlayerId;
    assert.ok(drawerId);
    drawers.push(drawerId);

    const drawer = clients.find((client) => client.id === drawerId);
    assert.ok(drawer, 'drawer client');

    const drawerView = drawer.id === host.id ? view : await syncView(drawer.socket);
    assert.equal(drawerView.canDraw, true);
    assert.equal(drawerView.referenceImage, null);

    const strokeId = `stroke-${drawerView.turnId}-${drawers.length}`;
    const strokeRes = await ack<{ success: boolean; error?: { message?: string } }>(
      drawer.socket,
      IMPOSTER_DRAW_STROKE_EVENT,
      sampleStroke(drawerView.turnId, strokeId),
    );
    assert.ok(strokeRes.success, strokeRes.error?.message ?? 'stroke');

    const undoRes = await ack<{
      success: boolean;
      data?: { view: ImposterDrawPlayerView };
    }>(drawer.socket, IMPOSTER_DRAW_UNDO_EVENT, { turnId: drawerView.turnId });
    assert.ok(undoRes.success);
    assert.ok(!(undoRes.data?.view.strokes ?? []).some((stroke) => stroke.id === strokeId));

    const redrawRes = await ack<{ success: boolean }>(
      drawer.socket,
      IMPOSTER_DRAW_STROKE_EVENT,
      sampleStroke(drawerView.turnId, `${strokeId}-keep`),
    );
    assert.ok(redrawRes.success);

    if (previousTurnId) {
      const stale = await ack<{ success: boolean }>(
        drawer.socket,
        IMPOSTER_DRAW_STROKE_EVENT,
        sampleStroke(previousTurnId, `stale-${previousTurnId}`),
      );
      assert.equal(stale.success, false, 'stale turn stroke rejected');
    }

    previousTurnId = drawerView.turnId;

    view = await waitFor(async () => {
      const next = await syncView(host.socket);
      if (next.gamePhase === 'voting') {
        return next;
      }
      if (
        next.gamePhase === 'drawing-turns' &&
        next.currentDrawerPlayerId &&
        next.currentDrawerPlayerId !== drawerId
      ) {
        return next;
      }
      if (next.gamePhase === 'drawing-turns' && next.turnId !== drawerView.turnId) {
        return next;
      }
      return null;
    }, 10000, 'next drawer or voting');
  }

  return drawers;
}

async function completeVotingAndGuess(clients: TestClient[]): Promise<void> {
  const host = clients[0]!;
  await waitForPhase(host, 'voting', 'voting phase');

  const views = await Promise.all(
    clients.map(async (client) => ({ client, view: await syncView(client.socket) })),
  );

  for (const entry of views) {
    assert.equal(entry.view.referenceImage, null);
    if (entry.view.hasVoted || entry.view.isMatchSpectator) {
      continue;
    }
    const target = entry.view.votablePlayers[0];
    assert.ok(target);
    const voteRes = await ack<{ success: boolean; error?: { message?: string } }>(
      entry.client.socket,
      IMPOSTER_DRAW_SUBMIT_VOTE_EVENT,
      { targetPlayerId: target.playerId },
    );
    assert.ok(voteRes.success, voteRes.error?.message ?? 'vote');
  }

  await waitForPhase(host, 'reveal', 'reveal phase');
  const reveal = await syncView(host.socket);
  assert.equal(reveal.referenceImage, null);
  assert.ok(reveal.revealedImpostorName);
  assert.equal(reveal.revealedAnswerLabel, null);
  assert.equal('voteTally' in reveal, false);

  await waitForPhase(host, 'impostor-guess', 'guess phase');
  const guessViews = await Promise.all(
    clients.map(async (client) => ({ client, view: await syncView(client.socket) })),
  );
  const impostor = guessViews.find((entry) => entry.view.role === 'impostor' && entry.view.canGuessImage);
  assert.ok(impostor, 'impostor guesser');
  assert.equal(impostor.view.referenceImage, null);
  assert.ok(impostor.view.impostorGuessOptions.length >= 2);

  const wrongOption =
    impostor.view.impostorGuessOptions.find((option) => option !== impostor.view.revealedAnswerLabel) ??
    impostor.view.impostorGuessOptions[0]!;
  const guessRes = await ack<{ success: boolean; data?: { view: ImposterDrawPlayerView } }>(
    impostor.client.socket,
    IMPOSTER_DRAW_SUBMIT_IMAGE_GUESS_EVENT,
    { selectedWord: wrongOption },
  );
  assert.ok(guessRes.success);
  assert.equal(guessRes.data?.view.gamePhase, 'guess-result');
  assert.ok(
    guessRes.data?.view.guessResultMessage === 'إجابة صحيحة!' ||
      guessRes.data?.view.guessResultMessage === 'إجابة خاطئة!',
  );

  await waitForPhase(host, 'round-results', 'round results');
  const results = await syncView(host.socket);
  assert.equal(results.referenceImage, null);
  assert.ok(results.revealedAnswerLabel);
  assert.equal('voteTally' in results, false);
}

async function runCompleteMatch(playerCount: number): Promise<void> {
  const clients = await createRoomWithPlayers(playerCount);
  const host = clients[0]!;

  try {
    await startImposterDraw(clients);

    const briefingViews = await Promise.all(clients.map((client) => syncView(client.socket)));
    assert.equal(briefingViews[0]!.totalRounds, 3);
    assert.equal(IMPOSTER_DRAW_TURN_SECONDS, 15);

    const impostors = briefingViews.filter((view) => view.role === 'impostor');
    assert.equal(impostors.length, 1);
    assert.equal(impostors[0]!.referenceImage, null);
    for (const view of briefingViews) {
      if (view.role === 'crew') {
        assert.ok(view.referenceImage);
      }
    }

    for (let round = 1; round <= 3; round += 1) {
      if (round > 1) {
        await waitFor(async () => {
          const view = await syncView(host.socket);
          return view.gamePhase === 'briefing' && view.currentRound === round ? view : null;
        }, 20000, `round ${round} briefing`);
      }

      const drawingView = await acknowledgeBriefing(clients);
      const drawers = await playThroughDrawing(clients, drawingView);
      assert.equal(drawers.length, playerCount, `every player draws once in round ${round}`);

      const afterDrawing = await syncView(host.socket);
      assert.ok(afterDrawing.strokes.length >= 1, 'cumulative canvas kept strokes');

      await completeVotingAndGuess(clients);

      if (round < 3) {
        const continueRes = await ack<{
          success: boolean;
          data?: { view: ImposterDrawPlayerView };
          error?: { message?: string };
        }>(host.socket, IMPOSTER_DRAW_CONTINUE_ROUND_RESULTS_EVENT, {});
        assert.ok(continueRes.success, continueRes.error?.message ?? 'continue');
      } else {
        const continueRes = await ack<{
          success: boolean;
          data?: { view: ImposterDrawPlayerView };
        }>(host.socket, IMPOSTER_DRAW_CONTINUE_ROUND_RESULTS_EVENT, {});
        assert.ok(continueRes.success);
        assert.equal(continueRes.data?.view.gamePhase, 'match-completed');
      }
    }

    await waitForPhase(host, 'match-completed', 'match completed');

    const lobbyRes = await ack<{ success: boolean; error?: { message?: string } }>(
      host.socket,
      IMPOSTER_DRAW_CONTINUE_ROUND_RESULTS_EVENT,
      {},
    );
    assert.ok(lobbyRes.success, lobbyRes.error?.message ?? 'return lobby');

    await waitFor(
      async () => (host.navigations.includes('/lobby') ? true : null),
      10000,
      'navigated to lobby',
      200,
    );

    const restartRes = await ack<{ success: boolean; error?: { message?: string } }>(
      host.socket,
      'game-shell-start-from-lobby',
      { gameId: IMPOSTER_DRAW_GAME_ID },
    );
    assert.ok(
      restartRes.success,
      restartRes.error?.message ?? 'Game A → Lobby → Game B must work',
    );
  } finally {
    await disconnectAll(clients);
  }
}

async function main(): Promise<void> {
  console.log('[imposter-draw] waiting for test server...');
  await waitForServer();

  await runTest('3-player complete match + shell cleanup', async () => {
    await runCompleteMatch(3);
  });

  await runTest('8-player complete match', async () => {
    await runCompleteMatch(8);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

void main();
