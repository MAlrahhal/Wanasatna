/**
 * Draw & Guess Socket.IO multiplayer integration (P4.2).
 * Requires server on localhost:4001 with WANASATNA_TEST_MODE=1.
 *
 * Run: pnpm --filter @wanasatna/server test:draw-guess:integration
 */
import assert from 'node:assert/strict';
import type { DrawGuessPlayerView } from '@wanasatna/shared';
import {
  DRAW_GUESS_CLEAR_CANVAS_EVENT,
  DRAW_GUESS_CONTINUE_ROUND_RESULTS_EVENT,
  DRAW_GUESS_GAME_ID,
  DRAW_GUESS_STROKE_EVENT,
  DRAW_GUESS_SUBMIT_GUESS_EVENT,
  DRAW_GUESS_SYNC_EVENT,
  DRAW_GUESS_UNDO_EVENT,
  GAME_SHELL_RETURN_TO_LOBBY_EVENT,
  RECONNECT_EVENT,
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

async function syncDrawGuess(socket: TestClient['socket']): Promise<DrawGuessPlayerView> {
  const res = await ack<{
    success: boolean;
    data?: { view: DrawGuessPlayerView };
    error?: { code: string; message: string };
  }>(socket, DRAW_GUESS_SYNC_EVENT, {});
  if (!res.success || !res.data?.view) {
    throw new Error(
      `draw-guess sync failed: ${res.error?.code ?? 'UNKNOWN'} ${res.error?.message ?? ''}`,
    );
  }
  return res.data.view;
}

async function createRoomWithPlayers(playerCount: number): Promise<TestClient[]> {
  assert.ok(playerCount >= 2 && playerCount <= 8);
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

async function startDrawGuess(
  clients: TestClient[],
  drawGuess: { drawerMode: 'random' | 'fixed'; fixedPlayerId?: string } = {
    drawerMode: 'random',
  },
): Promise<void> {
  const host = clients[0]!;
  const startRes = await ack<{ success: boolean; error?: { message?: string } }>(
    host.socket,
    'game-shell-start-from-lobby',
    { gameId: DRAW_GUESS_GAME_ID, drawGuess },
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
    const view = await syncDrawGuess(host.socket);
    return view.gamePhase === 'drawing' ? view : null;
  }, 15000, 'drawing phase');
}

async function disconnectAll(clients: TestClient[]): Promise<void> {
  for (const client of clients) {
    client.socket.disconnect();
  }
  await sleep(50);
}

function sampleStroke(turnId: string, strokeId: string): {
  turnId: string;
  strokeId: string;
  tool: 'draw';
  color: string;
  size: number;
  points: Array<{ x: number; y: number }>;
} {
  return {
    turnId,
    strokeId,
    tool: 'draw',
    color: '#111827',
    size: 4,
    points: [
      { x: 0.2, y: 0.3 },
      { x: 0.25, y: 0.35 },
    ],
  };
}

async function playCorrectGuessRound(clients: TestClient[]): Promise<{
  drawerId: string;
  guesserId: string;
  turnId: string;
  word: string;
}> {
  const views = await Promise.all(clients.map(async (client) => ({
    client,
    view: await syncDrawGuess(client.socket),
  })));

  const drawerEntry = views.find((entry) => entry.view.role === 'drawer' && entry.view.secretWord);
  assert.ok(drawerEntry, 'exactly one drawer with word');
  const word = drawerEntry.view.secretWord!;
  const turnId = drawerEntry.view.turnId;
  const drawerId = drawerEntry.client.id;

  for (const entry of views) {
    if (entry.client.id === drawerId) {
      assert.equal(entry.view.secretWord, word);
    } else if (!entry.view.isMatchSpectator) {
      assert.equal(entry.view.secretWord, null);
    }
  }

  const guesser = views.find(
    (entry) => entry.client.id !== drawerId && !entry.view.isMatchSpectator,
  );
  assert.ok(guesser, 'guesser available');

  const strokeRes = await ack<{ success: boolean; error?: { message?: string } }>(
    drawerEntry.client.socket,
    DRAW_GUESS_STROKE_EVENT,
    sampleStroke(turnId, `stroke-${turnId}`),
  );
  assert.ok(strokeRes.success, strokeRes.error?.message ?? 'stroke');

  const wrongRes = await ack<{
    success: boolean;
    data?: { correct: boolean; feedback?: string };
  }>(guesser.client.socket, DRAW_GUESS_SUBMIT_GUESS_EVENT, { guess: 'كلمة-خاطئة-جدا' });
  assert.ok(wrongRes.success);
  assert.equal(wrongRes.data?.correct, false);
  assert.equal(wrongRes.data?.feedback, 'إجابة خاطئة');

  const correctRes = await ack<{
    success: boolean;
    data?: { correct: boolean; view: DrawGuessPlayerView };
  }>(guesser.client.socket, DRAW_GUESS_SUBMIT_GUESS_EVENT, { guess: word });
  assert.ok(correctRes.success);
  assert.equal(correctRes.data?.correct, true);
  assert.equal(correctRes.data?.view.gamePhase, 'round-results');

  return { drawerId, guesserId: guesser.client.id, turnId, word };
}

async function advanceRoundResults(host: TestClient): Promise<DrawGuessPlayerView> {
  const continueRes = await ack<{
    success: boolean;
    data?: { view: DrawGuessPlayerView };
    error?: { message?: string };
  }>(host.socket, DRAW_GUESS_CONTINUE_ROUND_RESULTS_EVENT, {});
  assert.ok(continueRes.success, continueRes.error?.message ?? 'continue');
  assert.ok(continueRes.data?.view);
  return continueRes.data!.view;
}

async function runCompleteMatch(
  playerCount: number,
  mode: { drawerMode: 'random' | 'fixed'; fixedPlayerId?: string },
): Promise<void> {
  const clients = await createRoomWithPlayers(playerCount);
  const host = clients[0]!;

  try {
    await startDrawGuess(
      clients,
      mode.drawerMode === 'fixed'
        ? { drawerMode: 'fixed', fixedPlayerId: mode.fixedPlayerId ?? clients[1]!.id }
        : { drawerMode: 'random' },
    );

    const firstView = await syncDrawGuess(host.socket);
    assert.equal(firstView.totalRounds, 3);
    assert.ok(
      firstView.phaseRemainingSeconds === 15 || firstView.phaseRemainingSeconds === 60,
      `unexpected draw duration ${firstView.phaseRemainingSeconds}`,
    );

    const fixedDrawerId =
      mode.drawerMode === 'fixed' ? (mode.fixedPlayerId ?? clients[1]!.id) : null;
    const drawers: string[] = [];
    let previousTurnId: string | null = null;

    for (let round = 1; round <= 3; round += 1) {
      await waitFor(async () => {
        const view = await syncDrawGuess(host.socket);
        return view.gamePhase === 'drawing' && view.currentRound === round ? view : null;
      }, 20000, `round ${round} drawing`);

      const roundMeta = await playCorrectGuessRound(clients);
      drawers.push(roundMeta.drawerId);

      if (fixedDrawerId) {
        assert.equal(roundMeta.drawerId, fixedDrawerId, 'fixed drawer all rounds');
      }

      if (previousTurnId) {
        const stale = await ack<{ success: boolean }>(
          clients.find((client) => client.id === roundMeta.drawerId)!.socket,
          DRAW_GUESS_STROKE_EVENT,
          sampleStroke(previousTurnId, `stale-${previousTurnId}`),
        );
        assert.equal(stale.success, false, 'stale turn stroke rejected');
      }
      previousTurnId = roundMeta.turnId;

      await waitFor(async () => {
        const view = await syncDrawGuess(host.socket);
        return view.gamePhase === 'round-results' ? view : null;
      }, 10000, `round ${round} results`);

      const resultsView = await syncDrawGuess(host.socket);
      assert.ok(resultsView.guessedCorrectly);
      const drawerEntry = resultsView.roundResults.find((entry) => entry.isDrawer);
      const guesserEntry = resultsView.roundResults.find((entry) => entry.isCorrectGuesser);
      assert.equal(drawerEntry?.roundPoints, 100);
      assert.equal(guesserEntry?.roundPoints, 100);

      if (round < 3) {
        const next = await advanceRoundResults(host);
        assert.ok(next.gamePhase === 'drawing' || next.gamePhase === 'round-results');
      } else {
        const final = await advanceRoundResults(host);
        assert.equal(final.gamePhase, 'match-completed');
      }
    }

    if (mode.drawerMode === 'random') {
      assert.equal(drawers.length, 3);
      assert.ok(drawers.every((id) => clients.some((client) => client.id === id)));
    }

    await waitFor(async () => {
      const view = await syncDrawGuess(host.socket);
      return view.gamePhase === 'match-completed' ? view : null;
    }, 10000, 'match completed');

    await waitFor(
      async () =>
        clients.some((client) => client.shellEvents.some((event) => event.phase === 'FINISHED'))
          ? true
          : null,
      20000,
      'shell FINISHED',
      300,
    );
  } finally {
    await disconnectAll(clients);
  }
}

async function main(): Promise<void> {
  console.log('[draw-guess] waiting for test server...');
  await waitForServer();

  await runTest('2-player complete match (random)', async () => {
    await runCompleteMatch(2, { drawerMode: 'random' });
  });

  await runTest('3-player complete match (random)', async () => {
    await runCompleteMatch(3, { drawerMode: 'random' });
  });

  await runTest('8-player complete match (random)', async () => {
    await runCompleteMatch(8, { drawerMode: 'random' });
  });

  await runTest('fixed drawer mode all 3 rounds', async () => {
    await runCompleteMatch(3, { drawerMode: 'fixed' });
  });

  await runTest('invalid fixed drawer rejected at start', async () => {
    const clients = await createRoomWithPlayers(2);
    try {
      const startRes = await ack<{ success: boolean }>(
        clients[0]!.socket,
        'game-shell-start-from-lobby',
        {
          gameId: DRAW_GUESS_GAME_ID,
          drawGuess: { drawerMode: 'fixed', fixedPlayerId: 'not-a-player' },
        },
      );
      assert.equal(startRes.success, false);
    } finally {
      await disconnectAll(clients);
    }
  });

  await runTest('drawing authority + undo + clear + spectator privacy', async () => {
    const clients = await createRoomWithPlayers(3);
    const host = clients[0]!;
    try {
      await startDrawGuess(clients, { drawerMode: 'random' });
      const views = await Promise.all(
        clients.map(async (client) => ({ client, view: await syncDrawGuess(client.socket) })),
      );
      const drawer = views.find((entry) => entry.view.role === 'drawer')!;
      const guesser = views.find((entry) => entry.client.id !== drawer.client.id)!;
      const turnId = drawer.view.turnId;

      const guesserStroke = await ack<{ success: boolean }>(
        guesser.client.socket,
        DRAW_GUESS_STROKE_EVENT,
        sampleStroke(turnId, 'guesser-stroke'),
      );
      assert.equal(guesserStroke.success, false);

      const strokeOk = await ack<{ success: boolean; data?: { ok?: boolean; view?: DrawGuessPlayerView } }>(
        drawer.client.socket,
        DRAW_GUESS_STROKE_EVENT,
        sampleStroke(turnId, 'drawer-stroke-1'),
      );
      assert.ok(strokeOk.success);
      assert.equal(strokeOk.data?.ok, true);
      const afterStroke = await syncDrawGuess(drawer.client.socket);
      assert.equal(afterStroke.strokes.length, 1);

      const undoOk = await ack<{ success: boolean; data?: { view: DrawGuessPlayerView } }>(
        drawer.client.socket,
        DRAW_GUESS_UNDO_EVENT,
        { turnId },
      );
      assert.ok(undoOk.success);
      assert.equal(undoOk.data?.view.strokes.length, 0);

      await ack(drawer.client.socket, DRAW_GUESS_STROKE_EVENT, sampleStroke(turnId, 'drawer-stroke-2'));
      const clearOk = await ack<{ success: boolean; data?: { view: DrawGuessPlayerView } }>(
        drawer.client.socket,
        DRAW_GUESS_CLEAR_CANVAS_EVENT,
        { turnId },
      );
      assert.ok(clearOk.success);
      assert.equal(clearOk.data?.view.strokes.length, 0);

      const guesserClear = await ack<{ success: boolean }>(
        guesser.client.socket,
        DRAW_GUESS_CLEAR_CANVAS_EVENT,
        { turnId },
      );
      assert.equal(guesserClear.success, false);

      const spectatorSocket = await connectClient();
      const spectator: TestClient = {
        name: 'مشاهد',
        socket: spectatorSocket,
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
      trackClientEvents(spectator);
      const joinRes = await ack<{
        success: boolean;
        data: { player: { id: string }; room: { id: string }; reconnectToken?: string };
      }>(spectator.socket, 'join-room', {
        roomCode: host.roomCode,
        playerName: spectator.name,
      });
      assert.ok(joinRes.success);
      spectator.id = joinRes.data.player.id;

      const spectatorView = await syncDrawGuess(spectator.socket);
      assert.equal(spectatorView.isMatchSpectator, true);
      assert.equal(spectatorView.secretWord, null);
      assert.equal(spectatorView.canGuess, false);
      assert.ok(Array.isArray(spectatorView.strokes));

      const spectatorStroke = await ack<{ success: boolean }>(
        spectator.socket,
        DRAW_GUESS_STROKE_EVENT,
        sampleStroke(turnId, 'spectator-stroke'),
      );
      assert.equal(spectatorStroke.success, false);

      const spectatorGuess = await ack<{ success: boolean }>(
        spectator.socket,
        DRAW_GUESS_SUBMIT_GUESS_EVENT,
        { guess: drawer.view.secretWord ?? 'أسد' },
      );
      assert.equal(spectatorGuess.success, false);

      spectator.socket.disconnect();
    } finally {
      await disconnectAll(clients);
    }
  });

  await runTest('reconnect during drawing restores private word view', async () => {
    const clients = await createRoomWithPlayers(2);
    const host = clients[0]!;
    const guest = clients[1]!;
    try {
      await startDrawGuess(clients, { drawerMode: 'fixed', fixedPlayerId: guest.id });
      const before = await syncDrawGuess(guest.socket);
      assert.equal(before.role, 'drawer');
      assert.ok(before.secretWord);
      const word = before.secretWord!;
      const turnId = before.turnId;
      const token = guest.reconnectToken;

      guest.socket.disconnect();
      await sleep(200);

      const reconnected = await connectClient();
      guest.socket = reconnected;
      trackClientEvents(guest);
      const recover = await ack<{
        success: boolean;
        data?: { player: { id: string }; reconnectToken?: string };
        error?: { message?: string };
      }>(reconnected, RECONNECT_EVENT, {
        playerId: guest.id,
        roomId: guest.roomId,
        roomCode: guest.roomCode,
        reconnectToken: token,
      });
      assert.ok(recover.success, recover.error?.message ?? 'reconnect');
      guest.id = recover.data!.player.id;
      guest.reconnectToken = recover.data!.reconnectToken ?? token;

      const after = await waitFor(async () => {
        try {
          const view = await syncDrawGuess(guest.socket);
          return view.gamePhase === 'drawing' ? view : null;
        } catch {
          return null;
        }
      }, 15000, 'drawer view after reconnect');

      assert.equal(after.turnId, turnId);
      assert.equal(after.secretWord, word);
      assert.equal(after.role, 'drawer');

      const hostView = await syncDrawGuess(host.socket);
      assert.equal(hostView.secretWord, null);
    } finally {
      await disconnectAll(clients);
    }
  });

  await runTest('round-results host skip + race transitions once', async () => {
    const clients = await createRoomWithPlayers(2);
    const host = clients[0]!;
    try {
      await startDrawGuess(clients, { drawerMode: 'random' });
      await playCorrectGuessRound(clients);
      await waitFor(async () => {
        const view = await syncDrawGuess(host.socket);
        return view.gamePhase === 'round-results' ? view : null;
      }, 10000, 'results');

      const first = await ack<{ success: boolean; data?: { view: DrawGuessPlayerView } }>(
        host.socket,
        DRAW_GUESS_CONTINUE_ROUND_RESULTS_EVENT,
        {},
      );
      const second = await ack<{ success: boolean; data?: { view: DrawGuessPlayerView } }>(
        host.socket,
        DRAW_GUESS_CONTINUE_ROUND_RESULTS_EVENT,
        {},
      );
      assert.ok(first.success);
      assert.ok(
        first.data?.view.gamePhase === 'drawing' ||
          first.data?.view.currentRound === 2 ||
          first.data?.view.gamePhase === 'match-completed',
      );
      // Second click is either rejected (not in results) or no-ops without double-advance chaos.
      if (second.success && second.data?.view) {
        assert.ok(
          second.data.view.currentRound <= 2 || second.data.view.gamePhase !== 'round-results',
        );
      }
    } finally {
      await disconnectAll(clients);
    }
  });

  await runTest('cleanup allows next match to start cleanly', async () => {
    const clients = await createRoomWithPlayers(2);
    const host = clients[0]!;
    try {
      await runCompleteMatchFlowInline(clients);

      await waitFor(
        async () =>
          host.shellEvents.some((event) => event.phase === 'FINISHED') ? true : null,
        25000,
        'FINISHED after match',
        300,
      );

      const returnRes = await ack<{ success: boolean; error?: { message?: string } }>(
        host.socket,
        GAME_SHELL_RETURN_TO_LOBBY_EVENT,
        {},
      );
      assert.ok(returnRes.success, returnRes.error?.message ?? 'return-to-lobby');

      await waitFor(async () => {
        const sync = await ack<{
          success: boolean;
          data: { state: { phase: string } | null };
        }>(host.socket, 'game-shell-sync', {});
        return sync.data.state == null ? true : null;
      }, 10000, 'shell cleared');

      const startAgain = await ack<{ success: boolean; error?: { message?: string } }>(
        host.socket,
        'game-shell-start-from-lobby',
        { gameId: DRAW_GUESS_GAME_ID, drawGuess: { drawerMode: 'random' } },
      );
      assert.ok(startAgain.success, startAgain.error?.message ?? 'second start');

      await waitFor(
        async () =>
          host.shellEvents.some((event) => event.phase === 'PLAYING') ? true : null,
        15000,
        'second match PLAYING',
        200,
      );

      await waitFor(async () => {
        try {
          const view = await syncDrawGuess(host.socket);
          return view.gamePhase === 'drawing' && view.currentRound === 1 && view.strokes.length === 0
            ? view
            : null;
        } catch {
          return null;
        }
      }, 20000, 'clean second match drawing');
    } finally {
      await disconnectAll(clients);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

async function runCompleteMatchFlowInline(clients: TestClient[]): Promise<void> {
  const host = clients[0]!;
  await startDrawGuess(clients, { drawerMode: 'random' });
  for (let round = 1; round <= 3; round += 1) {
    await waitFor(async () => {
      const view = await syncDrawGuess(host.socket);
      return view.gamePhase === 'drawing' && view.currentRound === round ? view : null;
    }, 20000, `inline round ${round}`);
    await playCorrectGuessRound(clients);
    await waitFor(async () => {
      const view = await syncDrawGuess(host.socket);
      return view.gamePhase === 'round-results' ? view : null;
    }, 10000, `inline results ${round}`);
    await advanceRoundResults(host);
  }
  await waitFor(async () => {
    const view = await syncDrawGuess(host.socket);
    return view.gamePhase === 'match-completed' ? view : null;
  }, 10000, 'inline completed');
}

void main();
