import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { io as ioClient, type Socket } from 'socket.io-client';
import {
  CREATE_ROOM_EVENT,
  EMOJI_LANGUAGE_GAME_ID,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
  JOIN_ROOM_EVENT,
  LEAVE_ROOM_EVENT,
  MOST_LIKELY_TO_ADVANCE_EVENT,
  MOST_LIKELY_TO_GAME_ID,
  MOST_LIKELY_TO_SYNC_EVENT,
  MOST_LIKELY_TO_VOTE_EVENT,
  RECONNECT_EVENT,
  SECRET_AGENTS_ASSIGN_EVENT,
  SECRET_AGENTS_CONFIRM_CARD_EVENT,
  SECRET_AGENTS_GAME_ID,
  SECRET_AGENTS_SUBMIT_CLUE_EVENT,
  SECRET_AGENTS_SYNC_EVENT,
  SECRET_AGENTS_TOGGLE_NOMINATION_EVENT,
  SELECT_EXPERIMENTAL_GAME_EVENT,
  type CreateRoomResponse,
  type GameActionResponse,
  type MostLikelyToPlayerView,
  type ReconnectResponse,
  type RoomActionResponse,
  type RoomSessionData,
  type SecretAgentsPlayerView,
} from '@wanasatna/shared';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { setSocketServer } from '../src/lib/socket-server.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { stopExpiredAuthSessionCleanup } from '../src/modules/auth/auth-session-cleanup.js';
import { generateSessionToken, hashSessionToken } from '../src/modules/auth/session-token.js';
import { clearAllExperimentalGameSelectionsForTests } from '../src/modules/game/experimental/experimental-game-selection.store.js';
import { readPersistedExperimentalGameSelection } from '../src/modules/game/experimental/experimental-game-selection.store.js';
import { cleanupGameShellRuntime } from '../src/modules/game/game.lifecycle.js';
import { deleteGameShell } from '../src/modules/game/game.service.js';
import { cleanupPluginMatchState } from '../src/modules/game/runtime/cleanup-plugin-match.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { stopDisconnectedPlayerExpirySweep } from '../src/modules/room/services/disconnected-player-expiry.service.js';
import { createSocketServer } from '../src/sockets/index.js';

type Ack<T> = GameActionResponse<T>;

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

async function waitForMatchView(socket: Socket): Promise<SecretAgentsPlayerView> {
  const response = await ack<Ack<{ view: SecretAgentsPlayerView }>>(
    socket,
    SECRET_AGENTS_SYNC_EVENT,
    {},
  );
  assert.equal(response.success, true, response.success ? '' : response.error.message);
  if (!response.success) throw new Error(response.error.message);
  return response.data.view;
}

async function waitForMostLikelyToView(socket: Socket): Promise<MostLikelyToPlayerView> {
  const response = await ack<Ack<{ view: MostLikelyToPlayerView }>>(
    socket,
    MOST_LIKELY_TO_SYNC_EVENT,
    {},
  );
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
      email: `secret-agents-release-${marker}@example.test`,
      passwordHash: 'integration-test-only',
      preferredDisplayName: 'مدير الاختبار',
      role: 'ADMIN',
      adminTotpCredential: {
        create: {
          encryptedSecret: 'integration-test-only',
          enabledAt,
        },
      },
      authSessions: {
        create: {
          tokenHash: hashSessionToken(token),
          expiresAt: new Date(Date.now() + 60_000),
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
    await test('admin MFA route is protected and returns only the experimental registry', async () => {
      const guest = await fetch(`${baseUrl}/api/admin/experimental-games`);
      assert.equal(guest.status, 401);

      const authorized = await fetch(`${baseUrl}/api/admin/experimental-games`, {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(admin.token)}` },
      });
      assert.equal(authorized.status, 200);
      const body = (await authorized.json()) as {
        success: boolean;
        data: { enabled: boolean; games: Array<{ gameId: string }> };
      };
      assert.equal(body.success, true);
      assert.equal(body.data.enabled, true);
      assert.deepEqual(
        body.data.games.map((game) => game.gameId),
        [EMOJI_LANGUAGE_GAME_ID, MOST_LIKELY_TO_GAME_ID, SECRET_AGENTS_GAME_ID],
      );
    });

    await test('Most Likely To keeps votes private, restores reconnect, and uses current host controls', async () => {
      const host = await connect(baseUrl, admin.token);
      sockets.push(host);
      const created = await ack<CreateRoomResponse>(host, CREATE_ROOM_EVENT, {
        playerName: 'مضيف مين أكثر',
      });
      assert.equal(created.success, true, created.success ? '' : created.error.message);
      if (!created.success) throw new Error(created.error.message);
      roomIds.push(created.data.room.id);

      const selected = await ack<Ack<unknown>>(host, SELECT_EXPERIMENTAL_GAME_EVENT, {
        gameId: MOST_LIKELY_TO_GAME_ID,
      });
      assert.equal(selected.success, true, selected.success ? '' : selected.error.message);

      const joinedPlayers: Array<{ socket: Socket; session: RoomSessionData }> = [];
      for (const name of ['لاعب ثان', 'لاعب ثالث']) {
        const socket = await connect(baseUrl);
        sockets.push(socket);
        const joined = await ack<RoomActionResponse<RoomSessionData>>(socket, JOIN_ROOM_EVENT, {
          roomCode: created.data.room.code,
          playerName: name,
        });
        assert.equal(joined.success, true, joined.success ? '' : joined.error.message);
        if (!joined.success) throw new Error(joined.error.message);
        joinedPlayers.push({ socket, session: joined.data });
      }

      const forgedSelection = await ack<Ack<unknown>>(
        joinedPlayers[0]!.socket,
        SELECT_EXPERIMENTAL_GAME_EVENT,
        { gameId: MOST_LIKELY_TO_GAME_ID, isAdmin: true },
      );
      assert.equal(forgedSelection.success, false);
      if (!forgedSelection.success) assert.equal(forgedSelection.error.code, 'VALIDATION_ERROR');

      const forgedStart = await ack<Ack<unknown>>(
        joinedPlayers[0]!.socket,
        GAME_SHELL_START_FROM_LOBBY_EVENT,
        { gameId: MOST_LIKELY_TO_GAME_ID, isAdmin: true },
      );
      assert.equal(forgedStart.success, false);
      if (!forgedStart.success) assert.equal(forgedStart.error.code, 'NOT_HOST');

      const started = await ack<Ack<{ state: unknown }>>(host, GAME_SHELL_START_FROM_LOBBY_EVENT, {
        gameId: MOST_LIKELY_TO_GAME_ID,
      });
      assert.equal(started.success, true, started.success ? '' : started.error.message);
      await new Promise((resolve) => setTimeout(resolve, 3_500));

      const initialViews = await Promise.all(
        [host, ...joinedPlayers.map((entry) => entry.socket)].map(waitForMostLikelyToView),
      );
      assert.ok(initialViews.every((view) => view.questionId === initialViews[0]!.questionId));
      assert.ok(initialViews.every((view) => view.nominees.length === 3));
      assert.ok(
        initialViews.every((view) => view.result === null && view.ownVotePlayerId === null),
      );

      const forgedVote = await ack<Ack<unknown>>(
        joinedPlayers[0]!.socket,
        MOST_LIKELY_TO_VOTE_EVENT,
        {
          questionId: initialViews[0]!.questionId,
          nomineePlayerId: joinedPlayers[0]!.session.player.id,
          requestId: randomUUID(),
          voterPlayerId: created.data.player.id,
        },
      );
      assert.equal(forgedVote.success, false);
      if (!forgedVote.success) assert.equal(forgedVote.error.code, 'VALIDATION_ERROR');

      const firstVote = await ack<Ack<{ view: MostLikelyToPlayerView }>>(
        joinedPlayers[0]!.socket,
        MOST_LIKELY_TO_VOTE_EVENT,
        {
          questionId: initialViews[0]!.questionId,
          nomineePlayerId: joinedPlayers[0]!.session.player.id,
          requestId: randomUUID(),
        },
      );
      assert.equal(firstVote.success, true, firstVote.success ? '' : firstVote.error.message);
      if (!firstVote.success) throw new Error(firstVote.error.message);
      assert.equal(firstVote.data.view.ownVotePlayerId, joinedPlayers[0]!.session.player.id);

      const hostPrivateView = await waitForMostLikelyToView(host);
      assert.equal(hostPrivateView.submittedVoteCount, 1);
      assert.equal(hostPrivateView.ownVotePlayerId, null);
      assert.equal(hostPrivateView.result, null);

      const disconnected = joinedPlayers[0]!;
      disconnected.socket.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const reconnectedSocket = await connect(baseUrl);
      sockets.push(reconnectedSocket);
      const reconnected = await ack<ReconnectResponse>(reconnectedSocket, RECONNECT_EVENT, {
        playerId: disconnected.session.player.id,
        reconnectToken: disconnected.session.reconnectToken,
        roomCode: created.data.room.code,
      });
      assert.equal(reconnected.success, true, reconnected.success ? '' : reconnected.error.message);
      disconnected.socket = reconnectedSocket;
      const restored = await waitForMostLikelyToView(reconnectedSocket);
      assert.equal(restored.ownVotePlayerId, disconnected.session.player.id);
      assert.equal(restored.questionId, initialViews[0]!.questionId);
      assert.ok((restored.remainingSeconds ?? 0) > 0);

      const lateJoinSocket = await connect(baseUrl);
      sockets.push(lateJoinSocket);
      const lateJoin = await ack<RoomActionResponse<RoomSessionData>>(
        lateJoinSocket,
        JOIN_ROOM_EVENT,
        {
          roomCode: created.data.room.code,
          playerName: 'منضم لاحق',
        },
      );
      assert.equal(lateJoin.success, true, lateJoin.success ? '' : lateJoin.error.message);
      if (!lateJoin.success) throw new Error(lateJoin.error.message);
      const waiting = await waitForMostLikelyToView(lateJoinSocket);
      assert.equal(waiting.canVote, false);
      assert.equal(waiting.isWaitingForNextQuestion, true);
      assert.equal(waiting.nominees.length, 3);

      const secondVote = await ack<Ack<{ view: MostLikelyToPlayerView }>>(
        joinedPlayers[1]!.socket,
        MOST_LIKELY_TO_VOTE_EVENT,
        {
          questionId: initialViews[0]!.questionId,
          nomineePlayerId: created.data.player.id,
          requestId: randomUUID(),
        },
      );
      assert.equal(secondVote.success, true, secondVote.success ? '' : secondVote.error.message);
      const finalVote = await ack<Ack<{ view: MostLikelyToPlayerView }>>(
        host,
        MOST_LIKELY_TO_VOTE_EVENT,
        {
          questionId: initialViews[0]!.questionId,
          nomineePlayerId: joinedPlayers[0]!.session.player.id,
          requestId: randomUUID(),
        },
      );
      assert.equal(finalVote.success, true, finalVote.success ? '' : finalVote.error.message);
      if (!finalVote.success) throw new Error(finalVote.error.message);
      assert.equal(finalVote.data.view.phase, 'reveal');
      assert.equal(finalVote.data.view.result?.totalVotes, 3);
      assert.equal(finalVote.data.view.result?.votes.length, 3);

      const nonHostAdvance = await ack<Ack<unknown>>(
        joinedPlayers[1]!.socket,
        MOST_LIKELY_TO_ADVANCE_EVENT,
        { questionId: initialViews[0]!.questionId, requestId: randomUUID() },
      );
      assert.equal(nonHostAdvance.success, false);
      if (!nonHostAdvance.success) assert.equal(nonHostAdvance.error.code, 'NOT_HOST');

      const advancePayload = {
        questionId: initialViews[0]!.questionId,
        requestId: randomUUID(),
      };
      const [advanced, duplicateAdvance] = await Promise.all([
        ack<Ack<{ view: MostLikelyToPlayerView }>>(
          host,
          MOST_LIKELY_TO_ADVANCE_EVENT,
          advancePayload,
        ),
        ack<Ack<{ view: MostLikelyToPlayerView }>>(
          host,
          MOST_LIKELY_TO_ADVANCE_EVENT,
          advancePayload,
        ),
      ]);
      assert.equal(advanced.success, true, advanced.success ? '' : advanced.error.message);
      assert.equal(
        duplicateAdvance.success,
        true,
        duplicateAdvance.success ? '' : duplicateAdvance.error.message,
      );
      if (!advanced.success) throw new Error(advanced.error.message);
      if (!duplicateAdvance.success) throw new Error(duplicateAdvance.error.message);
      assert.equal(advanced.data.view.questionNumber, 2);
      assert.equal(advanced.data.view.nominees.length, 4);
      assert.equal(duplicateAdvance.data.view.questionNumber, 2);
      assert.equal(duplicateAdvance.data.view.questionId, advanced.data.view.questionId);
      const promoted = await waitForMostLikelyToView(lateJoinSocket);
      assert.equal(promoted.canVote, true);
      assert.equal(promoted.isWaitingForNextQuestion, false);

      const voters = [
        { socket: host, nominee: joinedPlayers[0]!.session.player.id },
        { socket: joinedPlayers[0]!.socket, nominee: created.data.player.id },
        { socket: joinedPlayers[1]!.socket, nominee: lateJoin.data.player.id },
        { socket: lateJoinSocket, nominee: created.data.player.id },
      ];
      for (const entry of voters) {
        const response = await ack<Ack<{ view: MostLikelyToPlayerView }>>(
          entry.socket,
          MOST_LIKELY_TO_VOTE_EVENT,
          {
            questionId: advanced.data.view.questionId,
            nomineePlayerId: entry.nominee,
            requestId: randomUUID(),
          },
        );
        assert.equal(response.success, true, response.success ? '' : response.error.message);
      }

      const left = await ack<RoomActionResponse<unknown>>(host, LEAVE_ROOM_EVENT, {});
      assert.equal(left.success, true, left.success ? '' : left.error.message);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const transferredView = await waitForMostLikelyToView(joinedPlayers[0]!.socket);
      assert.equal(transferredView.phase, 'reveal');
      assert.equal(transferredView.canAdvance, true);
    });

    await test('MFA admin creates; invited guests join and complete clue/nominate/confirm flow', async () => {
      let adminSocket = await connect(baseUrl, admin.token);
      sockets.push(adminSocket);
      const created = await ack<CreateRoomResponse>(adminSocket, CREATE_ROOM_EVENT, {
        playerName: 'مدير الاختبار',
      });
      assert.equal(created.success, true, created.success ? '' : created.error.message);
      if (!created.success) throw new Error(created.error.message);
      roomIds.push(created.data.room.id);

      const selected = await ack<Ack<{ roomId: string; gameId: string }>>(
        adminSocket,
        SELECT_EXPERIMENTAL_GAME_EVENT,
        { gameId: SECRET_AGENTS_GAME_ID },
      );
      assert.equal(selected.success, true, selected.success ? '' : selected.error.message);

      const stored = await prisma.room.findUniqueOrThrow({
        where: { id: created.data.room.id },
        select: { gameSettings: true, history: { select: { createdByAdmin: true } } },
      });
      assert.equal(stored.history?.createdByAdmin, true);
      assert.equal(
        readPersistedExperimentalGameSelection(stored.gameSettings)?.adminUserId,
        admin.userId,
      );

      const reconnectToken = created.data.reconnectToken;
      assert.ok(reconnectToken);
      adminSocket.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const afterDisconnect = await prisma.room.findUniqueOrThrow({
        where: { id: created.data.room.id },
        select: { gameSettings: true },
      });
      assert.equal(
        readPersistedExperimentalGameSelection(afterDisconnect.gameSettings)?.gameId,
        SECRET_AGENTS_GAME_ID,
      );

      adminSocket = await connect(baseUrl, admin.token);
      sockets.push(adminSocket);
      const reconnected = await ack<ReconnectResponse>(adminSocket, RECONNECT_EVENT, {
        playerId: created.data.player.id,
        reconnectToken,
        roomCode: created.data.room.code,
      });
      assert.equal(reconnected.success, true, reconnected.success ? '' : reconnected.error.message);

      const players: Array<{ socket: Socket; session: RoomSessionData }> = [];
      for (const name of ['عميل أحمر', 'قائد أزرق', 'عميل أزرق']) {
        const socket = await connect(baseUrl);
        sockets.push(socket);
        const joined = await ack<RoomActionResponse<RoomSessionData>>(socket, JOIN_ROOM_EVENT, {
          roomCode: created.data.room.code,
          playerName: name,
        });
        assert.equal(joined.success, true, joined.success ? '' : joined.error.message);
        if (!joined.success) throw new Error(joined.error.message);
        players.push({ socket, session: joined.data });
      }

      const forgedSelection = await ack<Ack<unknown>>(
        players[0]!.socket,
        SELECT_EXPERIMENTAL_GAME_EVENT,
        { gameId: SECRET_AGENTS_GAME_ID, isAdmin: true },
      );
      assert.equal(forgedSelection.success, false);
      if (!forgedSelection.success) assert.equal(forgedSelection.error.code, 'VALIDATION_ERROR');

      const unauthorizedSelection = await ack<Ack<unknown>>(
        players[0]!.socket,
        SELECT_EXPERIMENTAL_GAME_EVENT,
        { gameId: SECRET_AGENTS_GAME_ID },
      );
      assert.equal(unauthorizedSelection.success, false);
      if (!unauthorizedSelection.success)
        assert.equal(unauthorizedSelection.error.code, 'FORBIDDEN');

      const assignments = [
        [adminSocket, 'red', 'spymaster'],
        [players[0]!.socket, 'red', 'operative'],
        [players[1]!.socket, 'blue', 'spymaster'],
        [players[2]!.socket, 'blue', 'operative'],
      ] as const;
      for (const [socket, team, role] of assignments) {
        const response = await ack<Ack<{ view: unknown }>>(socket, SECRET_AGENTS_ASSIGN_EVENT, {
          team,
          role,
        });
        assert.equal(response.success, true, response.success ? '' : response.error.message);
      }

      const forgedStart = await ack<Ack<unknown>>(
        players[0]!.socket,
        GAME_SHELL_START_FROM_LOBBY_EVENT,
        { gameId: SECRET_AGENTS_GAME_ID, isAdmin: true, userId: admin.userId },
      );
      assert.equal(forgedStart.success, false);
      if (!forgedStart.success) assert.equal(forgedStart.error.code, 'NOT_HOST');

      const started = await ack<Ack<{ state: unknown }>>(
        adminSocket,
        GAME_SHELL_START_FROM_LOBBY_EVENT,
        { gameId: SECRET_AGENTS_GAME_ID },
      );
      assert.equal(started.success, true, started.success ? '' : started.error.message);

      const afterStart = await prisma.room.findUniqueOrThrow({
        where: { id: created.data.room.id },
        select: { gameSettings: true },
      });
      assert.equal(readPersistedExperimentalGameSelection(afterStart.gameSettings), null);

      await new Promise((resolve) => setTimeout(resolve, 3_500));
      const candidateSockets = [adminSocket, ...players.map((entry) => entry.socket)];
      const views = await Promise.all(candidateSockets.map((socket) => waitForMatchView(socket)));
      const spyIndex = views.findIndex((view) => view.canSubmitClue);
      assert.notEqual(spyIndex, -1);
      const operativeIndex = views.findIndex(
        (view) =>
          view.selfAssignment?.role === 'operative' &&
          view.selfAssignment.team === views[spyIndex]!.activeTeam,
      );
      assert.notEqual(operativeIndex, -1);
      assert.equal(Object.keys(views[spyIndex]!.secretKey ?? {}).length, 25);
      assert.equal(views[operativeIndex]!.secretKey, null);

      const clue = await ack<Ack<{ view: SecretAgentsPlayerView }>>(
        candidateSockets[spyIndex]!,
        SECRET_AGENTS_SUBMIT_CLUE_EVENT,
        { turnId: views[spyIndex]!.turnId, word: 'زمرد', value: 1 },
      );
      assert.equal(clue.success, true, clue.success ? '' : clue.error.message);
      if (!clue.success) throw new Error(clue.error.message);

      const target = clue.data.view.cards.find((card) => !card.revealed);
      assert.ok(target);
      const nominated = await ack<Ack<{ view: SecretAgentsPlayerView }>>(
        candidateSockets[operativeIndex]!,
        SECRET_AGENTS_TOGGLE_NOMINATION_EVENT,
        { turnId: clue.data.view.turnId, cardId: target!.id, requestId: randomUUID() },
      );
      assert.equal(nominated.success, true, nominated.success ? '' : nominated.error.message);
      if (!nominated.success) throw new Error(nominated.error.message);
      const nominatedCard = nominated.data.view.cards.find((card) => card.id === target!.id);
      assert.equal(nominatedCard?.revealed, false);
      assert.equal(nominatedCard?.nominations.length, 1);

      const oppositeIndex = views.findIndex(
        (view) =>
          view.selfAssignment?.role === 'operative' &&
          view.selfAssignment.team !== nominated.data.view.selfAssignment?.team,
      );
      await new Promise((resolve) => setTimeout(resolve, 1_100));
      const opposite = await ack<Ack<{ view: SecretAgentsPlayerView }>>(
        candidateSockets[oppositeIndex]!,
        SECRET_AGENTS_SYNC_EVENT,
        {},
      );
      assert.equal(opposite.success, true);
      if (!opposite.success) throw new Error(opposite.error.message);
      assert.equal(
        opposite.data.view.cards.find((card) => card.id === target!.id)?.nominations.length,
        0,
      );

      const wrongRole = await ack<Ack<unknown>>(
        candidateSockets[spyIndex]!,
        SECRET_AGENTS_CONFIRM_CARD_EVENT,
        { turnId: clue.data.view.turnId, cardId: target!.id, requestId: randomUUID() },
      );
      assert.equal(wrongRole.success, false);

      const confirmed = await ack<Ack<{ view: SecretAgentsPlayerView }>>(
        candidateSockets[operativeIndex]!,
        SECRET_AGENTS_CONFIRM_CARD_EVENT,
        { turnId: clue.data.view.turnId, cardId: target!.id, requestId: randomUUID() },
      );
      assert.equal(confirmed.success, true, confirmed.success ? '' : confirmed.error.message);
      if (!confirmed.success) throw new Error(confirmed.error.message);
      assert.equal(
        confirmed.data.view.cards.find((card) => card.id === target!.id)?.revealed,
        true,
      );

      const persistedMatch = await prisma.match.findFirst({
        where: { roomId: created.data.room.id },
        select: { gameId: true, roomHistoryId: true },
      });
      assert.equal(persistedMatch?.gameId, SECRET_AGENTS_GAME_ID);
      assert.ok(persistedMatch?.roomHistoryId);
    });

    await test('permanent host transfer clears durable selection and cannot grant restart', async () => {
      const host = await connect(baseUrl, admin.token);
      sockets.push(host);
      const created = await ack<CreateRoomResponse>(host, CREATE_ROOM_EVENT, {
        playerName: 'مضيف النقل',
      });
      assert.equal(created.success, true, created.success ? '' : created.error.message);
      if (!created.success) throw new Error(created.error.message);
      roomIds.push(created.data.room.id);

      const selected = await ack<Ack<unknown>>(host, SELECT_EXPERIMENTAL_GAME_EVENT, {
        gameId: SECRET_AGENTS_GAME_ID,
      });
      assert.equal(selected.success, true);

      const nextHost = await connect(baseUrl);
      sockets.push(nextHost);
      const joined = await ack<RoomActionResponse<RoomSessionData>>(nextHost, JOIN_ROOM_EVENT, {
        roomCode: created.data.room.code,
        playerName: 'مضيف جديد',
      });
      assert.equal(joined.success, true, joined.success ? '' : joined.error.message);

      const left = await ack<RoomActionResponse<unknown>>(host, LEAVE_ROOM_EVENT, {});
      assert.equal(left.success, true, left.success ? '' : left.error.message);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const transferred = await prisma.room.findUniqueOrThrow({
        where: { id: created.data.room.id },
        select: { hostPlayerId: true, gameSettings: true },
      });
      assert.equal(transferred.hostPlayerId, joined.success ? joined.data.player.id : '');
      assert.equal(readPersistedExperimentalGameSelection(transferred.gameSettings), null);

      const restart = await ack<Ack<unknown>>(nextHost, GAME_SHELL_START_FROM_LOBBY_EVENT, {
        gameId: SECRET_AGENTS_GAME_ID,
        isAdmin: true,
      });
      assert.equal(restart.success, false);
      if (!restart.success) assert.equal(restart.error.code, 'FORBIDDEN');
    });

    await test('the real lobby flow admits fifteen participants and rejects a sixteenth', async () => {
      const host = await connect(baseUrl, admin.token);
      sockets.push(host);
      const created = await ack<CreateRoomResponse>(host, CREATE_ROOM_EVENT, {
        playerName: 'مضيف السعة',
      });
      assert.equal(created.success, true, created.success ? '' : created.error.message);
      if (!created.success) throw new Error(created.error.message);
      roomIds.push(created.data.room.id);

      const selected = await ack<Ack<unknown>>(host, SELECT_EXPERIMENTAL_GAME_EVENT, {
        gameId: SECRET_AGENTS_GAME_ID,
      });
      assert.equal(selected.success, true);

      const participantSockets = [host];
      for (let index = 1; index < 16; index += 1) {
        const socket = await connect(baseUrl);
        sockets.push(socket);
        const joined = await ack<RoomActionResponse<RoomSessionData>>(socket, JOIN_ROOM_EVENT, {
          roomCode: created.data.room.code,
          playerName: `لاعب ${index}`,
        });
        assert.equal(joined.success, true, joined.success ? '' : joined.error.message);
        participantSockets.push(socket);
      }

      for (const [index, socket] of participantSockets.entries()) {
        const assigned = await ack<Ack<unknown>>(socket, SECRET_AGENTS_ASSIGN_EVENT, {
          team: index % 2 === 0 ? 'red' : 'blue',
          role: index === 0 || index === 1 ? 'spymaster' : 'operative',
        });
        if (index < 15) {
          assert.equal(assigned.success, true, assigned.success ? '' : assigned.error.message);
        } else {
          assert.equal(assigned.success, false);
          if (!assigned.success) assert.equal(assigned.error.code, 'VALIDATION_ERROR');
        }
      }
    });
  } finally {
    for (const socket of sockets) socket.disconnect();
    for (const roomId of roomIds) {
      cleanupGameShellRuntime(roomId);
      cleanupPluginMatchState(roomId, SECRET_AGENTS_GAME_ID);
      cleanupPluginMatchState(roomId, MOST_LIKELY_TO_GAME_ID);
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
