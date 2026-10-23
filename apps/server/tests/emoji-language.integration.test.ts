import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { io as ioClient, type Socket } from 'socket.io-client';
import {
  CREATE_ROOM_EVENT,
  EMOJI_LANGUAGE_DEFAULT_SETTINGS,
  EMOJI_LANGUAGE_GAME_ID,
  EMOJI_LANGUAGE_SUBMIT_CLUE_EVENT,
  EMOJI_LANGUAGE_SUBMIT_GUESS_EVENT,
  EMOJI_LANGUAGE_SYNC_EVENT,
  EMOJI_LANGUAGE_UPDATE_SETTINGS_EVENT,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
  JOIN_ROOM_EVENT,
  LEAVE_ROOM_EVENT,
  RECONNECT_EVENT,
  SELECT_EXPERIMENTAL_GAME_EVENT,
  type CreateRoomResponse,
  type EmojiLanguagePlayerView,
  type EmojiLanguageSettings,
  type GameActionResponse,
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
import { settleEmojiLanguageDeadline } from '../src/modules/game/experimental/emoji-language/phase-timer.js';
import { getEmojiLanguageMatch } from '../src/modules/game/experimental/emoji-language/store.js';
import { cleanupGameShellRuntime } from '../src/modules/game/game.lifecycle.js';
import { deleteGameShell } from '../src/modules/game/game.service.js';
import { cleanupPluginMatchState } from '../src/modules/game/runtime/cleanup-plugin-match.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { stopDisconnectedPlayerExpirySweep } from '../src/modules/room/services/disconnected-player-expiry.service.js';
import { createSocketServer } from '../src/sockets/index.js';

type Ack<T> = GameActionResponse<T>;
type ViewData = { view: EmojiLanguagePlayerView };

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

async function syncView(socket: Socket): Promise<EmojiLanguagePlayerView> {
  const response = await ack<Ack<ViewData>>(socket, EMOJI_LANGUAGE_SYNC_EVENT, {});
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
      email: `emoji-language-${marker}@example.test`,
      passwordHash: 'integration-test-only',
      preferredDisplayName: 'مدير الاختبار',
      role: 'ADMIN',
      adminTotpCredential: {
        create: { encryptedSecret: 'integration-test-only', enabledAt },
      },
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

async function createSelectedRoom(input: {
  baseUrl: string;
  token: string;
  sockets: Socket[];
  roomIds: string[];
  settings: EmojiLanguageSettings;
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
    gameId: EMOJI_LANGUAGE_GAME_ID,
  });
  assert.equal(selected.success, true, selected.success ? '' : selected.error.message);

  const updated = await ack<Ack<unknown>>(
    host,
    EMOJI_LANGUAGE_UPDATE_SETTINGS_EVENT,
    input.settings,
  );
  assert.equal(updated.success, true, updated.success ? '' : updated.error.message);

  const guests: Array<{ socket: Socket; session: RoomSessionData }> = [];
  for (const name of ['مخمّن أول', 'مخمّن ثان']) {
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

function advanceToCompleted(io: ReturnType<typeof createSocketServer>, roomId: string): void {
  for (let step = 0; step < 20; step += 1) {
    const match = getEmojiLanguageMatch(roomId);
    assert.ok(match);
    if (match.round.phase === 'completed') return;
    assert.ok(match.round.deadlineAtMs);
    assert.equal(settleEmojiLanguageDeadline(io, roomId, match.round.deadlineAtMs), true);
  }
  throw new Error('Emoji Language did not reach completed phase.');
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
    await test('player-clue mode enforces private writer, immutable clue, reconnect, and scoring', async () => {
      const room = await createSelectedRoom({
        baseUrl,
        token: admin.token,
        sockets,
        roomIds,
        settings: { ...EMOJI_LANGUAGE_DEFAULT_SETTINGS, roundCount: 3 },
      });

      const forgedSettings = await ack<Ack<unknown>>(
        room.guests[0]!.socket,
        EMOJI_LANGUAGE_UPDATE_SETTINGS_EVENT,
        { ...EMOJI_LANGUAGE_DEFAULT_SETTINGS, isAdmin: true },
      );
      assert.equal(forgedSettings.success, false);
      if (!forgedSettings.success) assert.equal(forgedSettings.error.code, 'VALIDATION_ERROR');

      const guestSettings = await ack<Ack<unknown>>(
        room.guests[0]!.socket,
        EMOJI_LANGUAGE_UPDATE_SETTINGS_EVENT,
        EMOJI_LANGUAGE_DEFAULT_SETTINGS,
      );
      assert.equal(guestSettings.success, false);
      if (!guestSettings.success) assert.equal(guestSettings.error.code, 'FORBIDDEN');

      const forgedStart = await ack<Ack<unknown>>(
        room.guests[0]!.socket,
        GAME_SHELL_START_FROM_LOBBY_EVENT,
        { gameId: EMOJI_LANGUAGE_GAME_ID, isAdmin: true },
      );
      assert.equal(forgedStart.success, false);
      if (!forgedStart.success) assert.equal(forgedStart.error.code, 'NOT_HOST');

      const started = await ack<Ack<unknown>>(room.host, GAME_SHELL_START_FROM_LOBBY_EVENT, {
        gameId: EMOJI_LANGUAGE_GAME_ID,
        mode: 'server-puzzle',
      });
      assert.equal(started.success, true, started.success ? '' : started.error.message);
      await new Promise((resolve) => setTimeout(resolve, 3_500));

      const initial = await Promise.all([
        syncView(room.host),
        syncView(room.guests[0]!.socket),
        syncView(room.guests[1]!.socket),
      ]);
      const writerIndex = initial.findIndex((view) => view.isWriter);
      assert.equal(writerIndex, 0);
      assert.equal(initial[0]!.mode, 'player-clue');
      assert.ok(initial[writerIndex]!.privateAnswer);
      assert.equal(initial[1]!.privateAnswer, null);
      assert.equal(initial[2]!.privateAnswer, null);

      const forgedClue = await ack<Ack<unknown>>(
        room.guests[0]!.socket,
        EMOJI_LANGUAGE_SUBMIT_CLUE_EVENT,
        { roundId: initial[0]!.roundId, emojis: ['😀'], playerId: room.created.player.id },
      );
      assert.equal(forgedClue.success, false);

      const wrongWriter = await ack<Ack<unknown>>(
        room.guests[0]!.socket,
        EMOJI_LANGUAGE_SUBMIT_CLUE_EVENT,
        { roundId: initial[0]!.roundId, emojis: ['😀'] },
      );
      assert.equal(wrongWriter.success, false);

      const clue = await ack<Ack<ViewData>>(room.host, EMOJI_LANGUAGE_SUBMIT_CLUE_EVENT, {
        roundId: initial[0]!.roundId,
        emojis: ['😀', '☕'],
      });
      assert.equal(clue.success, true, clue.success ? '' : clue.error.message);
      if (!clue.success) throw new Error(clue.error.message);
      const fixedDeadline = clue.data.view.deadlineAtMs;

      const replacement = await ack<Ack<unknown>>(room.host, EMOJI_LANGUAGE_SUBMIT_CLUE_EVENT, {
        roundId: initial[0]!.roundId,
        emojis: ['🔥'],
      });
      assert.equal(replacement.success, false);

      const lateSocket = await connect(baseUrl);
      sockets.push(lateSocket);
      const lateJoin = await ack<RoomActionResponse<RoomSessionData>>(lateSocket, JOIN_ROOM_EVENT, {
        roomCode: room.created.room.code,
        playerName: 'متفرج متأخر',
      });
      assert.equal(lateJoin.success, true, lateJoin.success ? '' : lateJoin.error.message);
      const lateView = await syncView(lateSocket);
      assert.equal(lateView.isSpectator, true);
      assert.equal(lateView.canGuess, false);
      assert.deepEqual(lateView.clue, ['😀', '☕']);

      const reconnectToken = room.created.reconnectToken;
      assert.ok(reconnectToken);
      room.host.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const reconnectedHost = await connect(baseUrl, admin.token);
      sockets.push(reconnectedHost);
      const reconnected = await ack<ReconnectResponse>(reconnectedHost, RECONNECT_EVENT, {
        playerId: room.created.player.id,
        reconnectToken,
        roomCode: room.created.room.code,
      });
      assert.equal(reconnected.success, true, reconnected.success ? '' : reconnected.error.message);
      const restored = await syncView(reconnectedHost);
      assert.equal(restored.deadlineAtMs, fixedDeadline);
      assert.equal(restored.privateAnswer, initial[0]!.privateAnswer);
      assert.deepEqual(restored.clue, ['😀', '☕']);

      const first = await ack<
        Ack<ViewData & { feedback: { correct: boolean; placement: number } }>
      >(room.guests[0]!.socket, EMOJI_LANGUAGE_SUBMIT_GUESS_EVENT, {
        roundId: restored.roundId,
        answer: restored.privateAnswer ?? initial[0]!.privateAnswer,
        requestId: randomUUID(),
      });
      assert.equal(first.success, true, first.success ? '' : first.error.message);
      if (!first.success) throw new Error(first.error.message);
      assert.equal(first.data.feedback.correct, true);
      assert.equal(first.data.feedback.placement, 1);

      const second = await ack<
        Ack<ViewData & { feedback: { correct: boolean; placement: number } }>
      >(room.guests[1]!.socket, EMOJI_LANGUAGE_SUBMIT_GUESS_EVENT, {
        roundId: restored.roundId,
        answer: initial[0]!.privateAnswer,
        requestId: randomUUID(),
      });
      assert.equal(second.success, true, second.success ? '' : second.error.message);
      if (!second.success) throw new Error(second.error.message);
      assert.equal(second.data.feedback.placement, 2);
      assert.equal(second.data.view.phase, 'guessing');

      const active = getEmojiLanguageMatch(room.created.room.id);
      assert.ok(active?.round.deadlineAtMs);
      settleEmojiLanguageDeadline(io, room.created.room.id, active!.round.deadlineAtMs!);
      const results = await syncView(room.guests[0]!.socket);
      assert.equal(results.phase, 'round-results');
      assert.equal(results.revealedAnswer, initial[0]!.privateAnswer);
      assert.equal(
        results.leaderboard.find((entry) => entry.playerId === room.created.player.id)?.score,
        100,
      );
      assert.equal(
        results.leaderboard.find((entry) => entry.playerId === room.guests[0]!.session.player.id)
          ?.score,
        100,
      );
      assert.equal(
        results.leaderboard.find((entry) => entry.playerId === room.guests[1]!.session.player.id)
          ?.score,
        75,
      );

      advanceToCompleted(io, room.created.room.id);
      assert.equal((await syncView(room.guests[0]!.socket)).phase, 'completed');
    });

    await test('server-puzzle mode survives host transfer and completes with no writer award', async () => {
      const room = await createSelectedRoom({
        baseUrl,
        token: admin.token,
        sockets,
        roomIds,
        settings: {
          ...EMOJI_LANGUAGE_DEFAULT_SETTINGS,
          mode: 'server-puzzle',
          roundCount: 3,
          guessingSeconds: 30,
        },
      });
      const started = await ack<Ack<unknown>>(room.host, GAME_SHELL_START_FROM_LOBBY_EVENT, {
        gameId: EMOJI_LANGUAGE_GAME_ID,
      });
      assert.equal(started.success, true, started.success ? '' : started.error.message);
      await new Promise((resolve) => setTimeout(resolve, 3_500));

      const before = await syncView(room.guests[0]!.socket);
      assert.equal(before.mode, 'server-puzzle');
      assert.equal(before.writerPlayerId, null);
      assert.equal(before.privateAnswer, null);
      assert.ok(before.clue?.length);
      const deadline = before.deadlineAtMs;

      const left = await ack<RoomActionResponse<unknown>>(room.host, LEAVE_ROOM_EVENT, {});
      assert.equal(left.success, true, left.success ? '' : left.error.message);
      await new Promise((resolve) => setTimeout(resolve, 150));
      const afterTransfer = await syncView(room.guests[0]!.socket);
      assert.equal(afterTransfer.phase, 'guessing');
      assert.equal(afterTransfer.deadlineAtMs, deadline);
      assert.deepEqual(afterTransfer.clue, before.clue);

      const authoritative = getEmojiLanguageMatch(room.created.room.id);
      assert.ok(authoritative);
      const guessed = await ack<
        Ack<ViewData & { feedback: { correct: boolean; placement: number } }>
      >(room.guests[0]!.socket, EMOJI_LANGUAGE_SUBMIT_GUESS_EVENT, {
        roundId: afterTransfer.roundId,
        answer: authoritative!.round.acceptedAnswers.at(-1),
        requestId: randomUUID(),
      });
      assert.equal(guessed.success, true, guessed.success ? '' : guessed.error.message);
      if (!guessed.success) throw new Error(guessed.error.message);
      assert.equal(guessed.data.feedback.correct, true);

      settleEmojiLanguageDeadline(io, room.created.room.id, authoritative!.round.deadlineAtMs!);
      const results = await syncView(room.guests[0]!.socket);
      assert.equal(results.phase, 'round-results');
      assert.equal(results.writerPlayerId, null);
      assert.equal(
        results.leaderboard.find((entry) => entry.playerId === room.guests[0]!.session.player.id)
          ?.score,
        100,
      );
      assert.equal(
        results.leaderboard.find((entry) => entry.playerId === room.guests[1]!.session.player.id)
          ?.score,
        0,
      );
      advanceToCompleted(io, room.created.room.id);
      assert.equal((await syncView(room.guests[1]!.socket)).phase, 'completed');
    });
  } finally {
    for (const socket of sockets) socket.disconnect();
    for (const roomId of roomIds) {
      cleanupGameShellRuntime(roomId);
      cleanupPluginMatchState(roomId, EMOJI_LANGUAGE_GAME_ID);
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
