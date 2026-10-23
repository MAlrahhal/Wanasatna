import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { io as ioClient, type Socket } from 'socket.io-client';
import {
  CREATE_ROOM_EVENT,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
  JOIN_ROOM_EVENT,
  LEAVE_ROOM_EVENT,
  RECONNECT_EVENT,
  SELECT_EXPERIMENTAL_GAME_EVENT,
  TIMELINE_PLACEMENT_CHOOSE_EVENT,
  TIMELINE_PLACEMENT_CONTINUE_EVENT,
  TIMELINE_PLACEMENT_DEFAULT_SETTINGS,
  TIMELINE_PLACEMENT_GAME_ID,
  TIMELINE_PLACEMENT_SYNC_EVENT,
  TIMELINE_PLACEMENT_UPDATE_SETTINGS_EVENT,
  type CreateRoomResponse,
  type GameActionResponse,
  type ReconnectResponse,
  type RoomActionResponse,
  type RoomSessionData,
  type TimelinePlacementPlayerView,
} from '@wanasatna/shared';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { setSocketServer } from '../src/lib/socket-server.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { stopExpiredAuthSessionCleanup } from '../src/modules/auth/auth-session-cleanup.js';
import { generateSessionToken, hashSessionToken } from '../src/modules/auth/session-token.js';
import { clearAllExperimentalGameSelectionsForTests } from '../src/modules/game/experimental/experimental-game-selection.store.js';
import { settleTimelinePlacementDeadline } from '../src/modules/game/experimental/timeline-placement/phase-timer.js';
import { getTimelinePlacementMatch } from '../src/modules/game/experimental/timeline-placement/store.js';
import { cleanupGameShellRuntime } from '../src/modules/game/game.lifecycle.js';
import { deleteGameShell, getGameShellByRoomId } from '../src/modules/game/game.service.js';
import { cleanupPluginMatchState } from '../src/modules/game/runtime/cleanup-plugin-match.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { stopDisconnectedPlayerExpirySweep } from '../src/modules/room/services/disconnected-player-expiry.service.js';
import { createSocketServer } from '../src/sockets/index.js';

type Ack<T> = GameActionResponse<T>;
type ViewData = { view: TimelinePlacementPlayerView };

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

async function syncView(socket: Socket): Promise<TimelinePlacementPlayerView> {
  const response = await ack<Ack<ViewData>>(socket, TIMELINE_PLACEMENT_SYNC_EVENT, {});
  assert.equal(response.success, true, response.success ? '' : response.error.message);
  if (!response.success) throw new Error(response.error.message);
  return response.data.view;
}

async function choose(socket: Socket, view: TimelinePlacementPlayerView, gapId: string) {
  return ack<Ack<ViewData>>(socket, TIMELINE_PLACEMENT_CHOOSE_EVENT, {
    roundId: view.roundId,
    gapId,
  });
}

async function createAdminFixture() {
  const marker = randomUUID();
  const userId = randomUUID();
  const token = generateSessionToken();
  const enabledAt = new Date();
  await prisma.user.create({
    data: {
      id: userId,
      email: `timeline-placement-${marker}@example.test`,
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
    await test('admin starts a full private match; guests play, reconnect, transfer host, and tie', async () => {
      let host = await connect(baseUrl, admin.token);
      sockets.push(host);
      const created = await ack<CreateRoomResponse>(host, CREATE_ROOM_EVENT, {
        playerName: 'مدير الاختبار',
      });
      assert.equal(created.success, true, created.success ? '' : created.error.message);
      if (!created.success) throw new Error(created.error.message);
      roomIds.push(created.data.room.id);

      const selected = await ack<Ack<unknown>>(host, SELECT_EXPERIMENTAL_GAME_EVENT, {
        gameId: TIMELINE_PLACEMENT_GAME_ID,
      });
      assert.equal(selected.success, true, selected.success ? '' : selected.error.message);

      const settings = await ack<Ack<unknown>>(host, TIMELINE_PLACEMENT_UPDATE_SETTINGS_EVENT, {
        ...TIMELINE_PLACEMENT_DEFAULT_SETTINGS,
        roundCount: 5,
      });
      assert.equal(settings.success, true, settings.success ? '' : settings.error.message);

      const guestSockets: Socket[] = [];
      const guestSessions: RoomSessionData[] = [];
      for (const name of ['لاعب أول', 'لاعب ثان']) {
        const socket = await connect(baseUrl);
        sockets.push(socket);
        const joined = await ack<RoomActionResponse<RoomSessionData>>(socket, JOIN_ROOM_EVENT, {
          roomCode: created.data.room.code,
          playerName: name,
        });
        assert.equal(joined.success, true, joined.success ? '' : joined.error.message);
        if (!joined.success) throw new Error(joined.error.message);
        guestSockets.push(socket);
        guestSessions.push(joined.data);
      }

      const forgedSettings = await ack<Ack<unknown>>(
        guestSockets[0]!,
        TIMELINE_PLACEMENT_UPDATE_SETTINGS_EVENT,
        { ...TIMELINE_PLACEMENT_DEFAULT_SETTINGS, isAdmin: true },
      );
      assert.equal(forgedSettings.success, false);
      if (!forgedSettings.success) assert.equal(forgedSettings.error.code, 'VALIDATION_ERROR');

      const ordinarySettings = await ack<Ack<unknown>>(
        guestSockets[0]!,
        TIMELINE_PLACEMENT_UPDATE_SETTINGS_EVENT,
        TIMELINE_PLACEMENT_DEFAULT_SETTINGS,
      );
      assert.equal(ordinarySettings.success, false);
      if (!ordinarySettings.success) assert.equal(ordinarySettings.error.code, 'FORBIDDEN');

      const forgedStart = await ack<Ack<unknown>>(
        guestSockets[0]!,
        GAME_SHELL_START_FROM_LOBBY_EVENT,
        { gameId: TIMELINE_PLACEMENT_GAME_ID, isAdmin: true },
      );
      assert.equal(forgedStart.success, false);
      if (!forgedStart.success) assert.equal(forgedStart.error.code, 'NOT_HOST');

      const started = await ack<Ack<unknown>>(host, GAME_SHELL_START_FROM_LOBBY_EVENT, {
        gameId: TIMELINE_PLACEMENT_GAME_ID,
        selectionSeconds: 1,
        year: 2024,
        eventId: 'forged-event',
      });
      assert.equal(started.success, true, started.success ? '' : started.error.message);
      await new Promise((resolve) => setTimeout(resolve, 3_500));

      let initial = await syncView(host);
      assert.equal(initial.settings.roundCount, 5);
      assert.equal(initial.settings.selectionSeconds, 30);
      assert.equal(initial.timeline.length, 2);
      assert.equal(initial.phase, 'selecting');
      assert.equal('year' in initial.candidate!, false);
      assert.equal('sourceUrl' in initial.candidate!, false);

      const wrongGap = initial.availableGaps[0]!.id;
      const firstChoice = await choose(host, initial, wrongGap);
      assert.equal(firstChoice.success, true, firstChoice.success ? '' : firstChoice.error.message);
      if (!firstChoice.success) throw new Error(firstChoice.error.message);
      const revisedGap = initial.availableGaps.at(-1)!.id;
      const revised = await choose(host, firstChoice.data.view, revisedGap);
      assert.equal(revised.success, true, revised.success ? '' : revised.error.message);
      if (!revised.success) throw new Error(revised.error.message);
      const privateOther = await syncView(guestSockets[0]!);
      assert.equal(privateOther.ownGapId, null);
      assert.equal(privateOther.submittedChoiceCount, 1);
      assert.deepEqual(privateOther.placements, []);

      const lateSocket = await connect(baseUrl);
      sockets.push(lateSocket);
      const lateJoin = await ack<RoomActionResponse<RoomSessionData>>(lateSocket, JOIN_ROOM_EVENT, {
        roomCode: created.data.room.code,
        playerName: 'متفرج متأخر',
      });
      assert.equal(lateJoin.success, true, lateJoin.success ? '' : lateJoin.error.message);
      const lateView = await syncView(lateSocket);
      assert.equal(lateView.isSpectator, true);
      assert.equal(lateView.canChoose, false);
      assert.equal((await choose(lateSocket, lateView, wrongGap)).success, false);

      const reconnectToken = created.data.reconnectToken;
      assert.ok(reconnectToken);
      const fixedDeadline = revised.data.view.deadlineAtMs;
      host.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
      host = await connect(baseUrl, admin.token);
      sockets.push(host);
      const reconnected = await ack<ReconnectResponse>(host, RECONNECT_EVENT, {
        playerId: created.data.player.id,
        reconnectToken,
        roomCode: created.data.room.code,
      });
      assert.equal(reconnected.success, true, reconnected.success ? '' : reconnected.error.message);
      initial = await syncView(host);
      assert.equal(initial.ownGapId, revisedGap);
      assert.equal(initial.deadlineAtMs, fixedDeadline);

      let authoritative = getTimelinePlacementMatch(created.data.room.id);
      assert.ok(authoritative);
      for (const socket of guestSockets) {
        const view = await syncView(socket);
        const chosen = await choose(socket, view, authoritative!.round.correctGapId);
        assert.equal(chosen.success, true, chosen.success ? '' : chosen.error.message);
      }
      const hostCorrected = await choose(host, initial, authoritative!.round.correctGapId);
      assert.equal(hostCorrected.success, true);

      settleTimelinePlacementDeadline(io, created.data.room.id, authoritative!.round.deadlineAtMs!);
      const namesFirst = await syncView(guestSockets[0]!);
      assert.equal(namesFirst.phase, 'placements-reveal');
      assert.equal(namesFirst.placements.length, 3);
      assert.ok(namesFirst.placements.every((entry) => entry.isCorrect === null));
      assert.equal(namesFirst.revealedAnswer, null);

      authoritative = getTimelinePlacementMatch(created.data.room.id);
      settleTimelinePlacementDeadline(io, created.data.room.id, authoritative!.round.deadlineAtMs!);
      const answer = await syncView(guestSockets[0]!);
      assert.equal(answer.phase, 'answer-reveal');
      assert.ok(answer.revealedAnswer?.event.year);
      assert.ok(answer.placements.every((entry) => entry.isCorrect === true));

      const nonHostContinue = await ack<Ack<ViewData>>(
        guestSockets[0]!,
        TIMELINE_PLACEMENT_CONTINUE_EVENT,
        { roundId: answer.roundId },
      );
      assert.equal(nonHostContinue.success, false);

      const left = await ack<RoomActionResponse<unknown>>(host, LEAVE_ROOM_EVENT, {});
      assert.equal(left.success, true, left.success ? '' : left.error.message);
      await new Promise((resolve) => setTimeout(resolve, 150));
      const afterTransfer = getTimelinePlacementMatch(created.data.room.id);
      assert.equal(afterTransfer?.round.phase, 'answer-reveal');
      assert.equal(afterTransfer?.round.deadlineAtMs, answer.deadlineAtMs);
      assert.equal(
        getGameShellByRoomId(created.data.room.id)?.hostPlayerId,
        guestSessions[0]!.player.id,
      );

      let current = answer;
      while (current.phase !== 'completed') {
        if (current.phase === 'answer-reveal') {
          const advanced = await ack<Ack<ViewData>>(
            guestSockets[0]!,
            TIMELINE_PLACEMENT_CONTINUE_EVENT,
            { roundId: current.roundId },
          );
          assert.equal(advanced.success, true, advanced.success ? '' : advanced.error.message);
          if (!advanced.success) throw new Error(advanced.error.message);
          current = advanced.data.view;
          continue;
        }
        assert.equal(current.phase, 'selecting');
        authoritative = getTimelinePlacementMatch(created.data.room.id);
        assert.ok(authoritative);
        for (const socket of guestSockets) {
          const chosen = await choose(socket, current, authoritative!.round.correctGapId);
          assert.equal(chosen.success, true, chosen.success ? '' : chosen.error.message);
        }
        settleTimelinePlacementDeadline(
          io,
          created.data.room.id,
          authoritative!.round.deadlineAtMs!,
        );
        authoritative = getTimelinePlacementMatch(created.data.room.id);
        settleTimelinePlacementDeadline(
          io,
          created.data.room.id,
          authoritative!.round.deadlineAtMs!,
        );
        const advanced = await ack<Ack<ViewData>>(
          guestSockets[0]!,
          TIMELINE_PLACEMENT_CONTINUE_EVENT,
          { roundId: current.roundId },
        );
        assert.equal(advanced.success, true, advanced.success ? '' : advanced.error.message);
        if (!advanced.success) throw new Error(advanced.error.message);
        current = advanced.data.view;
      }

      assert.equal(current.timeline.length, 7);
      assert.deepEqual(
        new Set(current.winnerPlayerIds),
        new Set([guestSessions[0]!.player.id, guestSessions[1]!.player.id]),
      );
      assert.equal(current.leaderboard[0]!.score, 500);
      assert.equal(current.leaderboard[1]!.score, 500);
      assert.equal(
        current.leaderboard.find((entry) => entry.playerId === created.data.player.id)?.score,
        100,
      );
    });
  } finally {
    for (const socket of sockets) socket.disconnect();
    for (const roomId of roomIds) {
      cleanupGameShellRuntime(roomId);
      cleanupPluginMatchState(roomId, TIMELINE_PLACEMENT_GAME_ID);
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
