import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { io as ioClient, type Socket } from 'socket.io-client';
import {
  CREATE_ROOM_EVENT,
  EYEWITNESS_ADVANCE_EVENT,
  EYEWITNESS_CONFIRM_VOTE_EVENT,
  EYEWITNESS_GAME_ID,
  EYEWITNESS_STROKE_EVENT,
  EYEWITNESS_SUBMIT_ARTWORK_EVENT,
  EYEWITNESS_SUBMIT_DESCRIPTION_EVENT,
  EYEWITNESS_SYNC_EVENT,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
  JOIN_ROOM_EVENT,
  RECONNECT_EVENT,
  SELECT_EXPERIMENTAL_GAME_EVENT,
  type CreateRoomResponse,
  type EyewitnessPlayerView,
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
import {
  getEyewitnessMatch,
  setEyewitnessMatch,
} from '../src/modules/game/experimental/eyewitness/store.js';
import { cleanupGameShellRuntime } from '../src/modules/game/game.lifecycle.js';
import { deleteGameShell } from '../src/modules/game/game.service.js';
import { cleanupPluginMatchState } from '../src/modules/game/runtime/cleanup-plugin-match.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { stopDisconnectedPlayerExpirySweep } from '../src/modules/room/services/disconnected-player-expiry.service.js';
import { createSocketServer } from '../src/sockets/index.js';

type Ack<T> = GameActionResponse<T>;
type ViewData = { view: EyewitnessPlayerView };

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

async function sync(socket: Socket): Promise<EyewitnessPlayerView> {
  const response = await ack<Ack<ViewData>>(socket, EYEWITNESS_SYNC_EVENT, {});
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
      email: `eyewitness-${marker}@example.test`,
      passwordHash: 'integration-test-only',
      preferredDisplayName: 'مدير الاختبار',
      role: 'ADMIN',
      adminTotpCredential: { create: { encryptedSecret: 'integration-test-only', enabledAt } },
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
      gameId: EYEWITNESS_GAME_ID,
    });
    assert.equal(selected.success, true, selected.success ? '' : selected.error.message);

    const participants: Array<{ socket: Socket; session: RoomSessionData }> = [
      { socket: host, session: created.data },
    ];
    for (const name of ['رسام أول', 'رسام ثان']) {
      const socket = await connect(baseUrl);
      sockets.push(socket);
      const joined = await ack<RoomActionResponse<RoomSessionData>>(socket, JOIN_ROOM_EVENT, {
        roomCode: created.data.room.code,
        playerName: name,
      });
      assert.equal(joined.success, true, joined.success ? '' : joined.error.message);
      if (!joined.success) throw new Error(joined.error.message);
      participants.push({ socket, session: joined.data });
    }

    const forgedStart = await ack<Ack<unknown>>(
      participants[1]!.socket,
      GAME_SHELL_START_FROM_LOBBY_EVENT,
      { gameId: EYEWITNESS_GAME_ID, isAdmin: true, userId: admin.userId },
    );
    assert.equal(forgedStart.success, false);
    if (!forgedStart.success) assert.equal(forgedStart.error.code, 'NOT_HOST');

    const started = await ack<Ack<{ state: unknown }>>(host, GAME_SHELL_START_FROM_LOBBY_EVENT, {
      gameId: EYEWITNESS_GAME_ID,
    });
    assert.equal(started.success, true, started.success ? '' : started.error.message);
    await new Promise((resolve) => setTimeout(resolve, 3_500));

    let views = await Promise.all(participants.map((entry) => sync(entry.socket)));
    const witnessIndex = views.findIndex((view) => view.isWitness);
    assert.notEqual(witnessIndex, -1);
    assert.match(
      views[witnessIndex]!.privateReferenceImageDataUrl ?? '',
      /^data:image\/jpeg;base64,/,
    );
    assert.ok(
      views
        .filter((_, index) => index !== witnessIndex)
        .every((view) => view.privateReferenceImageDataUrl === null),
    );
    assert.ok(views.every((view) => view.revealedReferenceImageDataUrl === null));

    const forgedDescription = await ack<Ack<unknown>>(
      participants[(witnessIndex + 1) % participants.length]!.socket,
      EYEWITNESS_SUBMIT_DESCRIPTION_EVENT,
      { roundId: views[0]!.roundId, description: 'مزور', isWitness: true },
    );
    assert.equal(forgedDescription.success, false);

    const witness = participants[witnessIndex]!;
    const privateImage = views[witnessIndex]!.privateReferenceImageDataUrl;
    witness.socket.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const observer = participants.find((_, index) => index !== witnessIndex)!;
    const paused = await sync(observer.socket);
    assert.equal(paused.waitingForWitness, true);
    assert.equal(paused.deadlineAtMs, null);

    const witnessReconnect = await connect(baseUrl);
    sockets.push(witnessReconnect);
    const witnessReconnected = await ack<ReconnectResponse>(witnessReconnect, RECONNECT_EVENT, {
      playerId: witness.session.player.id,
      reconnectToken: witness.session.reconnectToken,
      roomCode: created.data.room.code,
    });
    assert.equal(
      witnessReconnected.success,
      true,
      witnessReconnected.success ? '' : witnessReconnected.error.message,
    );
    witness.socket = witnessReconnect;
    const restoredWitness = await sync(witnessReconnect);
    assert.equal(restoredWitness.privateReferenceImageDataUrl, privateImage);
    assert.ok((restoredWitness.remainingSeconds ?? 0) > 0);

    const described = await ack<Ack<ViewData>>(
      witnessReconnect,
      EYEWITNESS_SUBMIT_DESCRIPTION_EVENT,
      { roundId: restoredWitness.roundId, description: 'مخلوق غريب يحمل أشياء ملونة' },
    );
    assert.equal(described.success, true, described.success ? '' : described.error.message);
    if (!described.success) throw new Error(described.error.message);
    assert.equal(described.data.view.phase, 'drawing');
    assert.equal(described.data.view.privateReferenceImageDataUrl, null);

    views = await Promise.all(participants.map((entry) => sync(entry.socket)));
    const artistIndexes = views.flatMap((view, index) => (view.isArtist ? [index] : []));
    assert.equal(artistIndexes.length, 2);
    assert.ok(views.every((view) => view.revealedReferenceImageDataUrl === null));
    assert.ok(views.every((view) => view.anonymousArtworks.length === 0));

    const firstArtist = participants[artistIndexes[0]!]!;
    const firstArtistView = views[artistIndexes[0]!]!;
    const strokeStart = await ack<Ack<unknown>>(firstArtist.socket, EYEWITNESS_STROKE_EVENT, {
      turnId: firstArtistView.roundId,
      strokeId: 'integration-stroke',
      tool: 'draw',
      color: '#111827',
      size: 8,
      points: [{ x: 10, y: 10 }],
    });
    assert.equal(strokeStart.success, true, strokeStart.success ? '' : strokeStart.error.message);

    firstArtist.socket.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const artistReconnect = await connect(baseUrl);
    sockets.push(artistReconnect);
    const artistReconnected = await ack<ReconnectResponse>(artistReconnect, RECONNECT_EVENT, {
      playerId: firstArtist.session.player.id,
      reconnectToken: firstArtist.session.reconnectToken,
      roomCode: created.data.room.code,
    });
    assert.equal(
      artistReconnected.success,
      true,
      artistReconnected.success ? '' : artistReconnected.error.message,
    );
    firstArtist.socket = artistReconnect;
    assert.equal((await sync(artistReconnect)).ownStrokes.length, 1);

    const lateSocket = await connect(baseUrl);
    sockets.push(lateSocket);
    const late = await ack<RoomActionResponse<RoomSessionData>>(lateSocket, JOIN_ROOM_EVENT, {
      roomCode: created.data.room.code,
      playerName: 'منضم لاحق',
    });
    assert.equal(late.success, true, late.success ? '' : late.error.message);
    assert.equal((await sync(lateSocket)).isSpectator, true);

    for (const index of artistIndexes) {
      const entry = participants[index]!;
      const response = await ack<Ack<ViewData>>(entry.socket, EYEWITNESS_SUBMIT_ARTWORK_EVENT, {
        roundId: views[index]!.roundId,
      });
      assert.equal(response.success, true, response.success ? '' : response.error.message);
    }

    views = await Promise.all(participants.map((entry) => sync(entry.socket)));
    assert.ok(views.every((view) => view.phase === 'voting'));
    assert.ok(views.every((view) => view.revealedReferenceImageDataUrl));
    assert.ok(views.every((view) => view.anonymousArtworks.length === 2));
    assert.ok(
      views.every(
        (view) => JSON.stringify(view.anonymousArtworks).includes('artistPlayerId') === false,
      ),
    );

    const artistView = views[artistIndexes[0]!]!;
    const selfVote = await ack<Ack<unknown>>(
      participants[artistIndexes[0]!]!.socket,
      EYEWITNESS_CONFIRM_VOTE_EVENT,
      { roundId: artistView.roundId, artworkId: artistView.ownArtworkId },
    );
    assert.equal(selfVote.success, false);
    const spectatorVote = await ack<Ack<unknown>>(lateSocket, EYEWITNESS_CONFIRM_VOTE_EVENT, {
      roundId: artistView.roundId,
      artworkId: artistView.anonymousArtworks[0]!.artworkId,
    });
    assert.equal(spectatorVote.success, false);

    const witnessView = views[witnessIndex]!;
    const witnessFirst = witnessView.anonymousArtworks[0]!.artworkId;
    const witnessSecond = witnessView.anonymousArtworks[1]!.artworkId;
    for (const artworkId of [witnessFirst, witnessSecond]) {
      const voted = await ack<Ack<ViewData>>(witness.socket, EYEWITNESS_CONFIRM_VOTE_EVENT, {
        roundId: witnessView.roundId,
        artworkId,
      });
      assert.equal(voted.success, true, voted.success ? '' : voted.error.message);
    }
    const artistTarget = artistView.anonymousArtworks.find(
      (artwork) => artwork.artworkId !== artistView.ownArtworkId,
    )!;
    const artistVote = await ack<Ack<ViewData>>(
      participants[artistIndexes[0]!]!.socket,
      EYEWITNESS_CONFIRM_VOTE_EVENT,
      { roundId: artistView.roundId, artworkId: artistTarget.artworkId },
    );
    assert.equal(artistVote.success, true, artistVote.success ? '' : artistVote.error.message);
    assert.equal((await sync(witness.socket)).phase, 'voting');

    const runtime = getEyewitnessMatch(created.data.room.id);
    assert.ok(runtime);
    setEyewitnessMatch(created.data.room.id, {
      ...runtime!,
      round: { ...runtime!.round, deadlineAtMs: Date.now() - 1 },
    });
    const currentHostSocket = participants[0]!.socket;
    const results = await sync(currentHostSocket);
    assert.equal(results.phase, 'round-results');
    assert.equal(results.resultArtworks.length, 2);
    assert.ok(results.resultArtworks.every((artwork) => typeof artwork.artistName === 'string'));
    assert.equal(JSON.stringify(results).includes('votesByPlayerId'), false);

    const nonHostAdvance = await ack<Ack<unknown>>(
      participants.find((entry) => entry.session.player.id !== created.data.player.id)!.socket,
      EYEWITNESS_ADVANCE_EVENT,
      { roundId: results.roundId, requestId: randomUUID() },
    );
    assert.equal(nonHostAdvance.success, false);

    const advanced = await ack<Ack<ViewData>>(currentHostSocket, EYEWITNESS_ADVANCE_EVENT, {
      roundId: results.roundId,
      requestId: randomUUID(),
    });
    assert.equal(advanced.success, true, advanced.success ? '' : advanced.error.message);
    const lateNext = await sync(lateSocket);
    assert.equal(lateNext.isSpectator, false);
    assert.notEqual(
      advanced.success ? advanced.data.view.privateReferenceImageDataUrl : null,
      privateImage,
    );
    console.log(
      'PASS real Socket.IO round, secrecy, recovery, drawing, voting, and late admission',
    );
  } finally {
    for (const socket of sockets) socket.disconnect();
    for (const roomId of roomIds) {
      cleanupGameShellRuntime(roomId);
      cleanupPluginMatchState(roomId, EYEWITNESS_GAME_ID);
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
