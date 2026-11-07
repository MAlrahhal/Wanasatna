import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { io as ioClient, type Socket } from 'socket.io-client';
import {
  CREATE_ROOM_EVENT,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
  GAME_SHELL_STATE_EVENT,
  JOIN_ROOM_EVENT,
  LEAVE_ROOM_EVENT,
  RECONNECT_EVENT,
  SAME_WAVELENGTH_ASSIGN_EVENT,
  SAME_WAVELENGTH_CONFIRM_EVENT,
  SAME_WAVELENGTH_GAME_ID,
  SAME_WAVELENGTH_NEXT_EVENT,
  SAME_WAVELENGTH_PROPOSE_EVENT,
  SAME_WAVELENGTH_SUBMIT_CLUE_EVENT,
  SAME_WAVELENGTH_SYNC_EVENT,
  SAME_WAVELENGTH_UPDATE_SETTINGS_EVENT,
  SELECT_EXPERIMENTAL_GAME_EVENT,
  type CreateRoomResponse,
  type GameActionResponse,
  type GameShellState,
  type ReconnectResponse,
  type RoomActionResponse,
  type RoomSessionData,
  type SameWavelengthAssignment,
  type SameWavelengthPlayerView,
} from '@wanasatna/shared';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { setSocketServer } from '../src/lib/socket-server.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { stopExpiredAuthSessionCleanup } from '../src/modules/auth/auth-session-cleanup.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { generateSessionToken, hashSessionToken } from '../src/modules/auth/session-token.js';
import { clearAllExperimentalGameSelectionsForTests } from '../src/modules/game/experimental/experimental-game-selection.store.js';
import { settleSameWavelengthDeadline } from '../src/modules/game/experimental/same-wavelength/phase-timer.js';
import { getSameWavelengthMatch } from '../src/modules/game/experimental/same-wavelength/store.js';
import { cleanupGameShellRuntime } from '../src/modules/game/game.lifecycle.js';
import { deleteGameShell, getGameShellByRoomId } from '../src/modules/game/game.service.js';
import { cleanupPluginMatchState } from '../src/modules/game/runtime/cleanup-plugin-match.js';
import { stopDisconnectedPlayerExpirySweep } from '../src/modules/room/services/disconnected-player-expiry.service.js';
import { createSocketServer } from '../src/sockets/index.js';

type Ack<T> = GameActionResponse<T>;
type ViewData = { view: SameWavelengthPlayerView };

let passed = 0;
let failed = 0;

async function test(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  }
}

function ack<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    socket
      .timeout(15_000)
      .emit(event, payload, (error: Error | null, response: T) =>
        error ? reject(error) : resolve(response),
      );
  });
}

async function connect(baseUrl: string, sessionToken?: string): Promise<Socket> {
  const socket = ioClient(baseUrl, {
    autoConnect: true,
    withCredentials: true,
    transports: ['websocket'],
    extraHeaders: sessionToken
      ? { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(sessionToken)}` }
      : undefined,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}

async function syncView(socket: Socket): Promise<SameWavelengthPlayerView> {
  const response = await ack<Ack<ViewData>>(socket, SAME_WAVELENGTH_SYNC_EVENT, {});
  assert.equal(response.success, true, response.success ? '' : response.error.message);
  if (!response.success) throw new Error(response.error.message);
  return response.data.view;
}

function waitForPlayingShell(socket: Socket): Promise<GameShellState> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Timed out waiting for PLAYING shell.')),
      8_000,
    );
    const listener = ({ state: shell }: { state: GameShellState | null }) => {
      if (shell?.gameId !== SAME_WAVELENGTH_GAME_ID || shell.phase !== 'PLAYING') return;
      clearTimeout(timeout);
      socket.off(GAME_SHELL_STATE_EVENT, listener);
      resolve(shell);
    };
    socket.on(GAME_SHELL_STATE_EVENT, listener);
  });
}

async function waitForHost(roomId: string, hostPlayerId: string): Promise<GameShellState> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const shell = getGameShellByRoomId(roomId);
    if (shell?.hostPlayerId === hostPlayerId) return shell;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Authoritative host transfer did not arrive.');
}

async function createAdminFixture() {
  const marker = randomUUID();
  const userId = randomUUID();
  const token = generateSessionToken();
  const enabledAt = new Date();
  await prisma.user.create({
    data: {
      id: userId,
      email: `same-wavelength-${marker}@example.test`,
      passwordHash: 'integration-test-only',
      preferredDisplayName: 'مدير الاختبار',
      role: 'ADMIN',
      adminTotpCredential: {
        create: { encryptedSecret: 'integration-test-only', enabledAt },
      },
      authSessions: {
        create: {
          tokenHash: hashSessionToken(token),
          expiresAt: new Date(Date.now() + 180_000),
          mfaVerifiedAt: enabledAt,
        },
      },
    },
  });
  return { userId, token };
}

async function createSelectedRoom(input: {
  baseUrl: string;
  token: string;
  guestNames: string[];
  sockets: Socket[];
  roomIds: string[];
}) {
  const host = await connect(input.baseUrl, input.token);
  input.sockets.push(host);
  const created = await ack<CreateRoomResponse>(host, CREATE_ROOM_EVENT, {
    playerName: 'مدير الاختبار',
  });
  assert.equal(created.success, true, created.success ? '' : created.error.message);
  if (!created.success) throw new Error(created.error.message);
  input.roomIds.push(created.data.room.id);
  const selected = await ack<Ack<unknown>>(host, SELECT_EXPERIMENTAL_GAME_EVENT, {
    gameId: SAME_WAVELENGTH_GAME_ID,
  });
  assert.equal(selected.success, true, selected.success ? '' : selected.error.message);

  const guests: Array<{ socket: Socket; session: RoomSessionData }> = [];
  for (const name of input.guestNames) {
    const socket = await connect(input.baseUrl);
    input.sockets.push(socket);
    const joined = await ack<RoomActionResponse<RoomSessionData>>(socket, JOIN_ROOM_EVENT, {
      roomCode: created.data.room.code,
      playerName: name,
    });
    assert.equal(joined.success, true, joined.success ? '' : joined.error.message);
    if (!joined.success) throw new Error(joined.error.message);
    guests.push({ socket, session: joined.data });
  }
  return { host, created: created.data, guests };
}

async function assign(socket: Socket, assignment: SameWavelengthAssignment): Promise<void> {
  const response = await ack<Ack<unknown>>(socket, SAME_WAVELENGTH_ASSIGN_EVENT, assignment);
  assert.equal(response.success, true, response.success ? '' : response.error.message);
}

function finishThroughDeadlines(
  io: ReturnType<typeof createSocketServer>,
  roomId: string,
): SameWavelengthPlayerView['phase'] {
  for (let step = 0; step < 30; step += 1) {
    const match = getSameWavelengthMatch(roomId);
    assert.ok(match, 'authoritative match must exist');
    if (match.turn.phase === 'completed') return match.turn.phase;
    assert.ok(match.turn.deadlineAtMs);
    assert.equal(settleSameWavelengthDeadline(io, roomId, match.turn.deadlineAtMs), true);
  }
  throw new Error('Same Wavelength did not complete through production deadlines.');
}

async function main(): Promise<void> {
  resetAuthRateLimiterForTests();
  clearAllExperimentalGameSelectionsForTests();
  const admin = await createAdminFixture();
  const roomIds: string[] = [];
  const sockets: Socket[] = [];
  const app = createApp();
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await test('team mode enforces roles, privacy, reconnect, spectators, and host transfer', async () => {
      const room = await createSelectedRoom({
        baseUrl,
        token: admin.token,
        guestNames: ['ملمّح أحمر', 'مخمّن أحمر', 'ملمّح أزرق', 'مخمّن أزرق'],
        sockets,
        roomIds,
      });
      const hostId = room.created.player.id;
      const [redClue, redGuess, blueClue, blueGuess] = room.guests;

      const forgedSettings = await ack<Ack<unknown>>(
        redClue!.socket,
        SAME_WAVELENGTH_UPDATE_SETTINGS_EVENT,
        { mode: 'team', isAdmin: true },
      );
      assert.equal(forgedSettings.success, false);
      if (!forgedSettings.success) assert.equal(forgedSettings.error.code, 'VALIDATION_ERROR');

      const guestSettings = await ack<Ack<unknown>>(
        redClue!.socket,
        SAME_WAVELENGTH_UPDATE_SETTINGS_EVENT,
        { mode: 'team' },
      );
      assert.equal(guestSettings.success, false);
      if (!guestSettings.success) assert.equal(guestSettings.error.code, 'FORBIDDEN');

      const updated = await ack<Ack<unknown>>(room.host, SAME_WAVELENGTH_UPDATE_SETTINGS_EVENT, {
        mode: 'team',
      });
      assert.equal(updated.success, true, updated.success ? '' : updated.error.message);
      await assign(room.host, { team: 'red', role: 'guesser' });
      await assign(redClue!.socket, { team: 'red', role: 'clue-giver' });
      await assign(redGuess!.socket, { team: 'red', role: 'guesser' });
      await assign(blueClue!.socket, { team: 'blue', role: 'clue-giver' });
      await assign(blueGuess!.socket, { team: 'blue', role: 'guesser' });

      const shellReady = waitForPlayingShell(room.host);
      const started = await ack<Ack<unknown>>(room.host, GAME_SHELL_START_FROM_LOBBY_EVENT, {
        gameId: SAME_WAVELENGTH_GAME_ID,
      });
      assert.equal(started.success, true, started.success ? '' : started.error.message);
      await shellReady;

      const initial = await Promise.all([
        syncView(room.host),
        syncView(redClue!.socket),
        syncView(redGuess!.socket),
        syncView(blueClue!.socket),
        syncView(blueGuess!.socket),
      ]);
      assert.equal(initial[1]!.isClueGiver, true);
      assert.equal(typeof initial[1]!.privateTarget, 'number');
      assert.equal(initial[0]!.privateTarget, null);
      assert.equal(initial[2]!.privateTarget, null);

      const forgedClue = await ack<Ack<unknown>>(room.host, SAME_WAVELENGTH_SUBMIT_CLUE_EVENT, {
        turnId: initial[0]!.turnId,
        clue: 'تلميح مزور',
        requestId: randomUUID(),
      });
      assert.equal(forgedClue.success, false);

      const clue = await ack<Ack<ViewData>>(redClue!.socket, SAME_WAVELENGTH_SUBMIT_CLUE_EVENT, {
        turnId: initial[1]!.turnId,
        clue: 'حرارة كوب شاي',
        requestId: randomUUID(),
      });
      assert.equal(clue.success, true, clue.success ? '' : clue.error.message);
      if (!clue.success) return;
      const guessingDeadline = clue.data.view.deadlineAtMs;

      const reconnectToken = room.created.reconnectToken;
      assert.ok(reconnectToken);
      room.host.disconnect();
      const reconnectedHost = await connect(baseUrl, admin.token);
      sockets.push(reconnectedHost);
      const reconnected = await ack<ReconnectResponse>(reconnectedHost, RECONNECT_EVENT, {
        playerId: hostId,
        reconnectToken,
        roomCode: room.created.room.code,
      });
      assert.equal(reconnected.success, true, reconnected.success ? '' : reconnected.error.message);
      const restoredGuessing = await syncView(reconnectedHost);
      assert.equal(restoredGuessing.phase, 'guessing');
      assert.equal(restoredGuessing.deadlineAtMs, guessingDeadline);
      assert.equal(restoredGuessing.clue, 'حرارة كوب شاي');
      assert.equal(restoredGuessing.privateTarget, null);

      const proposed = await ack<Ack<ViewData>>(reconnectedHost, SAME_WAVELENGTH_PROPOSE_EVENT, {
        turnId: clue.data.view.turnId,
        position: 0,
        requestId: randomUUID(),
      });
      assert.equal(proposed.success, true, proposed.success ? '' : proposed.error.message);
      const teammateProposed = await ack<Ack<ViewData>>(
        redGuess!.socket,
        SAME_WAVELENGTH_PROPOSE_EVENT,
        {
          turnId: clue.data.view.turnId,
          position: 0,
          requestId: randomUUID(),
        },
      );
      assert.equal(
        teammateProposed.success,
        true,
        teammateProposed.success ? '' : teammateProposed.error.message,
      );
      const confirmed = await ack<Ack<ViewData>>(reconnectedHost, SAME_WAVELENGTH_CONFIRM_EVENT, {
        turnId: clue.data.view.turnId,
        requestId: randomUUID(),
      });
      assert.equal(confirmed.success, true, confirmed.success ? '' : confirmed.error.message);
      const teammateConfirmed = await ack<Ack<ViewData>>(
        redGuess!.socket,
        SAME_WAVELENGTH_CONFIRM_EVENT,
        { turnId: clue.data.view.turnId, requestId: randomUUID() },
      );
      assert.equal(
        teammateConfirmed.success,
        true,
        teammateConfirmed.success ? '' : teammateConfirmed.error.message,
      );
      if (!teammateConfirmed.success) return;
      assert.equal(teammateConfirmed.data.view.phase, 'turn-results');
      assert.equal(teammateConfirmed.data.view.agreedGuess, 0);
      const restored = await syncView(reconnectedHost);
      assert.equal(restored.phase, 'turn-results');
      assert.equal(restored.revealedTarget, teammateConfirmed.data.view.revealedTarget);
      assert.equal(restored.turnPoints, teammateConfirmed.data.view.turnPoints);

      const lateSocket = await connect(baseUrl);
      sockets.push(lateSocket);
      const lateJoin = await ack<RoomActionResponse<RoomSessionData>>(lateSocket, JOIN_ROOM_EVENT, {
        roomCode: room.created.room.code,
        playerName: 'متفرج متأخر',
      });
      assert.equal(lateJoin.success, true, lateJoin.success ? '' : lateJoin.error.message);
      const lateView = await syncView(lateSocket);
      assert.equal(lateView.isSpectator, true);
      assert.equal(lateView.canPropose, false);
      assert.equal(lateView.privateTarget, null);

      const left = await ack<RoomActionResponse<unknown>>(reconnectedHost, LEAVE_ROOM_EVENT, {});
      assert.equal(left.success, true, left.success ? '' : left.error.message);
      await waitForHost(room.created.room.id, redClue!.session.player.id);
      const transferred = await syncView(redClue!.socket);
      assert.equal(transferred.canAdvance, true);
      assert.equal(transferred.revealedTarget, restored.revealedTarget);

      const unauthorizedRestart = await ack<Ack<unknown>>(
        redClue!.socket,
        GAME_SHELL_START_FROM_LOBBY_EVENT,
        { gameId: SAME_WAVELENGTH_GAME_ID },
      );
      assert.equal(unauthorizedRestart.success, false);

      const nextRequest = {
        turnId: transferred.turnId,
        requestId: randomUUID(),
      };
      const next = await ack<Ack<ViewData>>(
        redClue!.socket,
        SAME_WAVELENGTH_NEXT_EVENT,
        nextRequest,
      );
      assert.equal(next.success, true, next.success ? '' : next.error.message);
      if (!next.success) return;
      assert.equal(next.data.view.activeTeam, 'blue');
      assert.equal(next.data.view.currentRound, 1);
      assert.equal(next.data.view.canSubmitClue, false);
      const duplicateNext = await ack<Ack<ViewData>>(
        redClue!.socket,
        SAME_WAVELENGTH_NEXT_EVENT,
        nextRequest,
      );
      assert.equal(duplicateNext.success, false);
      const blueView = await syncView(blueClue!.socket);
      assert.equal(blueView.canSubmitClue, true);
      assert.equal(typeof blueView.privateTarget, 'number');
      assert.equal((await syncView(redClue!.socket)).privateTarget, null);

      assert.equal(finishThroughDeadlines(io, room.created.room.id), 'completed');
      const completed = await syncView(blueGuess!.socket);
      assert.equal(completed.phase, 'completed');
      assert.equal(completed.totalRounds, 3);
    });

    await test('individual mode completes five rounds with private guesses and authoritative scoring', async () => {
      const room = await createSelectedRoom({
        baseUrl,
        token: admin.token,
        guestNames: ['لاعب أول', 'لاعب ثان'],
        sockets,
        roomIds,
      });
      const shellReady = waitForPlayingShell(room.host);
      const started = await ack<Ack<unknown>>(room.host, GAME_SHELL_START_FROM_LOBBY_EVENT, {
        gameId: SAME_WAVELENGTH_GAME_ID,
        mode: 'forged-client-value',
      });
      assert.equal(started.success, true, started.success ? '' : started.error.message);
      await shellReady;

      const participants = [room.host, ...room.guests.map((entry) => entry.socket)];
      const views = await Promise.all(participants.map(syncView));
      const clueIndex = views.findIndex((view) => view.isClueGiver);
      assert.ok(clueIndex >= 0);
      const clueView = views[clueIndex]!;
      const guesserIndexes = views.flatMap((view, index) => (view.isClueGiver ? [] : [index]));
      const clue = await ack<Ack<ViewData>>(
        participants[clueIndex]!,
        SAME_WAVELENGTH_SUBMIT_CLUE_EVENT,
        { turnId: clueView.turnId, clue: 'صوت في غرفة هادئة', requestId: randomUUID() },
      );
      assert.equal(clue.success, true, clue.success ? '' : clue.error.message);
      if (!clue.success) return;

      const firstIndex = guesserIndexes[0]!;
      const firstProposal = await ack<Ack<ViewData>>(
        participants[firstIndex]!,
        SAME_WAVELENGTH_PROPOSE_EVENT,
        { turnId: clue.data.view.turnId, position: 0, requestId: randomUUID() },
      );
      assert.equal(firstProposal.success, true);
      const otherBefore = await syncView(participants[guesserIndexes[1]!]!);
      assert.equal(otherBefore.ownProposal, null);
      assert.deepEqual(otherBefore.teamProposals, []);

      for (const [offset, index] of guesserIndexes.entries()) {
        if (offset > 0) {
          const proposed = await ack<Ack<ViewData>>(
            participants[index]!,
            SAME_WAVELENGTH_PROPOSE_EVENT,
            { turnId: clue.data.view.turnId, position: 0, requestId: randomUUID() },
          );
          assert.equal(proposed.success, true, proposed.success ? '' : proposed.error.message);
        }
        const confirmed = await ack<Ack<ViewData>>(
          participants[index]!,
          SAME_WAVELENGTH_CONFIRM_EVENT,
          { turnId: clue.data.view.turnId, requestId: randomUUID() },
        );
        assert.equal(confirmed.success, true, confirmed.success ? '' : confirmed.error.message);
      }
      const results = await Promise.all(participants.map(syncView));
      assert.ok(results.every((view) => view.phase === 'turn-results'));
      assert.ok(results.every((view) => view.revealedTarget === results[0]!.revealedTarget));
      assert.ok(results.every((view) => view.privateTarget === null));

      assert.equal(finishThroughDeadlines(io, room.created.room.id), 'completed');
      const completed = await syncView(room.guests[0]!.socket);
      assert.equal(completed.phase, 'completed');
      assert.equal(completed.totalRounds, 5);
      assert.equal(completed.leaderboard.length, 3);
    });
  } finally {
    for (const socket of sockets) socket.disconnect();
    for (const roomId of roomIds) {
      cleanupGameShellRuntime(roomId);
      cleanupPluginMatchState(roomId, SAME_WAVELENGTH_GAME_ID);
      deleteGameShell(roomId);
    }
    stopDisconnectedPlayerExpirySweep();
    stopExpiredAuthSessionCleanup();
    setSocketServer(null);
    io.close();
    await new Promise<void>((resolve, reject) =>
      httpServer.close((error) => (error ? reject(error) : resolve())),
    );
    await prisma.match.deleteMany({ where: { roomId: { in: roomIds } } });
    await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
    await prisma.roomHistory.deleteMany({ where: { liveRoomId: { in: roomIds } } });
    await prisma.user.delete({ where: { id: admin.userId } }).catch(() => undefined);
    await prisma.$disconnect();
  }

  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
