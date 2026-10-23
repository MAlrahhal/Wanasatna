import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { io as ioClient, type Socket } from 'socket.io-client';
import {
  CREATE_ROOM_EVENT,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
  JOIN_ROOM_EVENT,
  ONE_WORD_ONLY_ADVANCE_EVENT,
  ONE_WORD_ONLY_CONFIRM_ANSWER_EVENT,
  ONE_WORD_ONLY_GAME_ID,
  ONE_WORD_ONLY_SUBMIT_CLUE_EVENT,
  ONE_WORD_ONLY_SYNC_EVENT,
  RECONNECT_EVENT,
  SELECT_EXPERIMENTAL_GAME_EVENT,
  type CreateRoomResponse,
  type GameActionResponse,
  type OneWordOnlyPlayerView,
  type ReconnectResponse,
  type RoomActionResponse,
  type RoomSessionData,
} from '@wanasatna/shared';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { setSocketServer } from '../src/lib/socket-server.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { stopExpiredAuthSessionCleanup } from '../src/modules/auth/auth-session-cleanup.js';
import { generateSessionToken, hashSessionToken } from '../src/modules/auth/session-token.js';
import { clearAllExperimentalGameSelectionsForTests } from '../src/modules/game/experimental/experimental-game-selection.store.js';
import { cleanupGameShellRuntime } from '../src/modules/game/game.lifecycle.js';
import { deleteGameShell } from '../src/modules/game/game.service.js';
import { cleanupPluginMatchState } from '../src/modules/game/runtime/cleanup-plugin-match.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { stopDisconnectedPlayerExpirySweep } from '../src/modules/room/services/disconnected-player-expiry.service.js';
import { createSocketServer } from '../src/sockets/index.js';

type Ack<T> = GameActionResponse<T>;
type ViewData = { view: OneWordOnlyPlayerView };

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

async function sync(socket: Socket): Promise<OneWordOnlyPlayerView> {
  const response = await ack<Ack<ViewData>>(socket, ONE_WORD_ONLY_SYNC_EVENT, {});
  assert.equal(response.success, true, response.success ? '' : response.error.message);
  if (!response.success) throw new Error(response.error.message);
  return response.data.view;
}

async function createAdminFixture() {
  const marker = randomUUID();
  const userId = randomUUID();
  const token = generateSessionToken();
  const enabledAt = new Date();
  await prisma.user.create({
    data: {
      id: userId,
      email: `one-word-only-${marker}@example.test`,
      passwordHash: 'integration-test-only',
      preferredDisplayName: 'مدير الاختبار',
      role: 'ADMIN',
      adminTotpCredential: { create: { encryptedSecret: 'integration-test-only', enabledAt } },
      authSessions: {
        create: {
          tokenHash: hashSessionToken(token),
          expiresAt: new Date(Date.now() + 120_000),
          mfaVerifiedAt: enabledAt,
        },
      },
    },
  });
  return { userId, token };
}

async function main(): Promise<void> {
  resetAuthRateLimiterForTests();
  clearAllExperimentalGameSelectionsForTests();
  const admin = await createAdminFixture();
  const roomIds: string[] = [];
  const sockets: Socket[] = [];
  const httpServer = createServer(createApp());
  const io = createSocketServer(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  const baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

  try {
    const host = await connect(baseUrl, admin.token);
    sockets.push(host);
    const created = await ack<CreateRoomResponse>(host, CREATE_ROOM_EVENT, {
      playerName: 'المضيف',
    });
    assert.equal(created.success, true, created.success ? '' : created.error.message);
    if (!created.success) throw new Error(created.error.message);
    roomIds.push(created.data.room.id);

    const selected = await ack<Ack<unknown>>(host, SELECT_EXPERIMENTAL_GAME_EVENT, {
      gameId: ONE_WORD_ONLY_GAME_ID,
    });
    assert.equal(selected.success, true, selected.success ? '' : selected.error.message);

    const guests: Array<{ socket: Socket; session: RoomSessionData }> = [];
    for (const name of ['كاتب أول', 'كاتب ثان']) {
      const socket = await connect(baseUrl);
      sockets.push(socket);
      const joined = await ack<RoomActionResponse<RoomSessionData>>(socket, JOIN_ROOM_EVENT, {
        roomCode: created.data.room.code,
        playerName: name,
      });
      assert.equal(joined.success, true, joined.success ? '' : joined.error.message);
      if (!joined.success) throw new Error(joined.error.message);
      guests.push({ socket, session: joined.data });
    }

    const forgedStart = await ack<Ack<unknown>>(
      guests[0]!.socket,
      GAME_SHELL_START_FROM_LOBBY_EVENT,
      { gameId: ONE_WORD_ONLY_GAME_ID, isAdmin: true, userId: admin.userId },
    );
    assert.equal(forgedStart.success, false);
    if (!forgedStart.success) assert.equal(forgedStart.error.code, 'NOT_HOST');

    const started = await ack<Ack<{ state: unknown }>>(host, GAME_SHELL_START_FROM_LOBBY_EVENT, {
      gameId: ONE_WORD_ONLY_GAME_ID,
    });
    assert.equal(started.success, true, started.success ? '' : started.error.message);
    await new Promise((resolve) => setTimeout(resolve, 3_500));

    const participants = [{ socket: host, session: created.data }, ...guests];
    let views = await Promise.all(participants.map((entry) => sync(entry.socket)));
    const guesserIndex = views.findIndex((view) => view.isGuesser);
    assert.notEqual(guesserIndex, -1);
    const writerIndexes = views.flatMap((view, index) => (view.canSubmitClue ? [index] : []));
    assert.equal(writerIndexes.length, 2);
    assert.equal(views[guesserIndex]!.privateAnswer, null);
    assert.ok(writerIndexes.every((index) => views[index]!.privateAnswer));
    assert.ok(views.every((view) => view.answerOptions.length === 0));
    const secretAnswer = views[writerIndexes[0]!]!.privateAnswer!;

    const forgedClue = await ack<Ack<unknown>>(
      participants[writerIndexes[0]!]!.socket,
      ONE_WORD_ONLY_SUBMIT_CLUE_EVENT,
      { roundId: views[0]!.roundId, clue: 'قوي', playerId: 'forged' },
    );
    assert.equal(forgedClue.success, false);

    for (const [offset, index] of writerIndexes.entries()) {
      const response = await ack<Ack<ViewData>>(
        participants[index]!.socket,
        ONE_WORD_ONLY_SUBMIT_CLUE_EVENT,
        { roundId: views[index]!.roundId, clue: offset === 0 ? 'قوي' : 'ملكي' },
      );
      assert.equal(response.success, true, response.success ? '' : response.error.message);
    }

    views = await Promise.all(participants.map((entry) => sync(entry.socket)));
    assert.ok(views.every((view) => view.phase === 'guessing'));
    assert.ok(views.every((view) => view.answerOptions.length === 8));
    assert.ok(views.every((view) => view.revealedCorrectAnswer === null));
    assert.ok(views.every((view) => view.survivingClues.length === 2));

    const unauthorized = await ack<Ack<unknown>>(
      participants[writerIndexes[0]!]!.socket,
      ONE_WORD_ONLY_CONFIRM_ANSWER_EVENT,
      {
        roundId: views[0]!.roundId,
        optionId: views[0]!.answerOptions[0]!.id,
        requestId: randomUUID(),
      },
    );
    assert.equal(unauthorized.success, false);

    const guesser = participants[guesserIndex]!;
    guesser.socket.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const paused = await sync(participants[writerIndexes[0]!]!.socket);
    assert.equal(paused.waitingForGuesser, true);
    assert.equal(paused.deadlineAtMs, null);

    const reconnectedSocket = await connect(baseUrl);
    sockets.push(reconnectedSocket);
    const reconnected = await ack<ReconnectResponse>(reconnectedSocket, RECONNECT_EVENT, {
      playerId: guesser.session.player.id,
      reconnectToken: guesser.session.reconnectToken,
      roomCode: created.data.room.code,
    });
    assert.equal(reconnected.success, true, reconnected.success ? '' : reconnected.error.message);
    guesser.socket = reconnectedSocket;
    const restored = await sync(reconnectedSocket);
    assert.equal(restored.isGuesser, true);
    assert.ok((restored.remainingSeconds ?? 0) > 0);
    const correctOption = restored.answerOptions.find((option) => option.text === secretAnswer);
    assert.ok(correctOption);

    const confirmed = await ack<Ack<ViewData>>(
      reconnectedSocket,
      ONE_WORD_ONLY_CONFIRM_ANSWER_EVENT,
      {
        roundId: restored.roundId,
        optionId: correctOption!.id,
        requestId: randomUUID(),
      },
    );
    assert.equal(confirmed.success, true, confirmed.success ? '' : confirmed.error.message);
    if (!confirmed.success) throw new Error(confirmed.error.message);
    assert.equal(confirmed.data.view.phase, 'round-reveal');
    assert.equal(confirmed.data.view.roundWasCorrect, true);
    assert.equal(confirmed.data.view.revealClues.length, 2);

    const nonHost = participants.find(
      (entry) => entry.session.player.id !== created.data.player.id,
    )!;
    const deniedAdvance = await ack<Ack<unknown>>(nonHost.socket, ONE_WORD_ONLY_ADVANCE_EVENT, {
      roundId: confirmed.data.view.roundId,
      requestId: randomUUID(),
    });
    assert.equal(deniedAdvance.success, false);

    const lateSocket = await connect(baseUrl);
    sockets.push(lateSocket);
    const late = await ack<RoomActionResponse<RoomSessionData>>(lateSocket, JOIN_ROOM_EVENT, {
      roomCode: created.data.room.code,
      playerName: 'منضم لاحق',
    });
    assert.equal(late.success, true, late.success ? '' : late.error.message);
    assert.equal((await sync(lateSocket)).isSpectator, true);

    const requestId = randomUUID();
    const currentHostSocket = participants[0]!.socket;
    const advanced = await ack<Ack<ViewData>>(currentHostSocket, ONE_WORD_ONLY_ADVANCE_EVENT, {
      roundId: confirmed.data.view.roundId,
      requestId,
    });
    const repeated = await ack<Ack<ViewData>>(currentHostSocket, ONE_WORD_ONLY_ADVANCE_EVENT, {
      roundId: confirmed.data.view.roundId,
      requestId,
    });
    assert.equal(advanced.success, true, advanced.success ? '' : advanced.error.message);
    assert.equal(repeated.success, true, repeated.success ? '' : repeated.error.message);
    assert.equal((await sync(lateSocket)).isSpectator, false);
    console.log(
      'PASS full Socket.IO match flow, secrecy, reconnect pause, authorization, and late admission',
    );
  } finally {
    for (const socket of sockets) socket.disconnect();
    for (const roomId of roomIds) {
      cleanupGameShellRuntime(roomId);
      cleanupPluginMatchState(roomId, ONE_WORD_ONLY_GAME_ID);
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
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
