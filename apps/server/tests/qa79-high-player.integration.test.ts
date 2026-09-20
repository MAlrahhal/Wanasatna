/**
 * QA-79 high-player Socket.IO regression.
 *
 * Runs a real in-process HTTP + Socket.IO server on an ephemeral port. The
 * automated-test database guard requires TEST_DATABASE_URL and rejects a URL
 * matching DATABASE_URL/PRODUCTION_DATABASE_URL before Prisma can connect.
 *
 * Run: pnpm --filter @wanasatna/server test:qa79-high-player
 */
import assert from 'node:assert/strict';
import { createServer, type Server as HttpServer } from 'node:http';
import { PlayerStatus } from '@prisma/client';
import { io as ioClient, type Socket } from 'socket.io-client';
import {
  ADMIN_ROOM_PLAYER_CAP,
  BARA_AL_SALAFA_GAME_ID,
  BARA_AL_SALAFA_SYNC_EVENT,
  CREATE_ROOM_EVENT,
  DRAW_GUESS_GAME_ID,
  DRAW_GUESS_STROKE_EVENT,
  DRAW_GUESS_SYNC_EVENT,
  FAST_ANSWER_GAME_ID,
  FAST_ANSWER_SUBMIT_ANSWER_EVENT,
  FAST_ANSWER_SYNC_EVENT,
  GAME_SHELL_NAVIGATE_EVENT,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
  GAME_SHELL_STATE_EVENT,
  GAME_SHELL_SYNC_EVENT,
  IMPOSTER_DRAW_GAME_ID,
  IMPOSTER_DRAW_STROKE_EVENT,
  IMPOSTER_DRAW_SUBMIT_ROLE_UNDERSTOOD_EVENT,
  IMPOSTER_DRAW_SYNC_EVENT,
  JUDGE_GAME_ID,
  JUDGE_SUBMIT_ANSWER_EVENT,
  JUDGE_SYNC_EVENT,
  JOIN_ROOM_EVENT,
  LEAVE_ROOM_EVENT,
  RECONNECT_EVENT,
  ROOM_SYNC_EVENT,
  TIMING_CHALLENGE_GAME_ID,
  TIMING_CHALLENGE_READY_EVENT,
  TIMING_CHALLENGE_SUBMIT_GUESS_EVENT,
  TIMING_CHALLENGE_SYNC_EVENT,
  WHO_WROTE_IT_GAME_ID,
  WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
  WHO_WROTE_IT_SYNC_EVENT,
  type BaraAlSalafaPlayerView,
  type CreateRoomResponse,
  type DrawGuessPlayerView,
  type FastAnswerPlayerView,
  type GameActionResponse,
  type GamePhase,
  type GameShellState,
  type ImposterDrawPlayerView,
  type JudgePlayerView,
  type ReconnectResponse,
  type RoomActionResponse,
  type RoomSessionData,
  type TimingChallengePlayerView,
  type WhoWroteItPlayerView,
} from '@wanasatna/shared';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { resetAbuseLimiterForTests } from '../src/lib/abuse-limiter.js';
import { prisma } from '../src/lib/prisma.js';
import { setSocketServer } from '../src/lib/socket-server.js';
import { promoteExistingUserToAdmin } from '../src/modules/admin/promote-existing-user.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { stopExpiredAuthSessionCleanup } from '../src/modules/auth/auth-session-cleanup.js';
import { loginUser, registerUser, resolveAuthSession } from '../src/modules/auth/auth.service.js';
import { deleteGameShell } from '../src/modules/game/game.service.js';
import { cleanupGameShellRuntime } from '../src/modules/game/game.lifecycle.js';
import { getBaraAlSalafaState } from '../src/modules/game/plugins/bara-al-salafa/store.js';
import { getDrawGuessState } from '../src/modules/game/plugins/draw-guess/store.js';
import { getFastAnswerState } from '../src/modules/game/plugins/fast-answer/store.js';
import { getImposterDrawState } from '../src/modules/game/plugins/imposter-draw/store.js';
import { getJudgeState } from '../src/modules/game/plugins/judge/store.js';
import { getTimingChallengeState } from '../src/modules/game/plugins/timing-challenge/store.js';
import { getWhoWroteItState } from '../src/modules/game/plugins/who-wrote-it/store.js';
import { cleanupPluginMatchState } from '../src/modules/game/runtime/cleanup-plugin-match.js';
import { stopDisconnectedPlayerExpirySweep } from '../src/modules/room/services/disconnected-player-expiry.service.js';
import { createSocketServer } from '../src/sockets/index.js';

const ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:3000';
const PLAYER_CHECKPOINTS = [8, 10, 15, 20] as const;
const TIMEOUT_MS = 20_000;

type VirtualClient = {
  name: string;
  socket: Socket;
  id: string;
  roomId: string;
  roomCode: string;
  reconnectToken: string;
  phases: GamePhase[];
  navigations: string[];
  navigationListenerAttached: boolean;
};

type TestServer = {
  baseUrl: string;
  httpServer: HttpServer;
  io: ReturnType<typeof createSocketServer>;
};

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function playerName(index: number): string {
  return `qa79-${index.toString().padStart(2, '0')}-${Math.floor(Math.random() * 10_000)}`;
}

function ack<T>(socket: Socket, event: string, payload: unknown = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    socket.timeout(TIMEOUT_MS).emit(event, payload, (error: Error | null, response: T) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  label: string,
  timeoutMs = TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function attachStateListener(client: VirtualClient): void {
  client.socket.on(GAME_SHELL_STATE_EVENT, (payload: { state: GameShellState | null }) => {
    if (payload.state) {
      client.phases.push(payload.state.phase);
    }
  });
}

function attachNavigationListener(client: VirtualClient): void {
  if (client.navigationListenerAttached) {
    return;
  }
  client.navigationListenerAttached = true;
  client.socket.on(GAME_SHELL_NAVIGATE_EVENT, (payload: { path: string }) => {
    client.navigations.push(payload.path);
  });
}

async function connectSocket(baseUrl: string, cookie?: string): Promise<Socket> {
  const socket = ioClient(baseUrl, {
    autoConnect: true,
    withCredentials: true,
    extraHeaders: cookie ? { cookie } : { origin: ORIGIN },
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket connection timed out')), TIMEOUT_MS);
    socket.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  return socket;
}

async function startServer(): Promise<TestServer> {
  resetAuthRateLimiterForTests();
  resetAbuseLimiterForTests();
  setSocketServer(null);
  const httpServer = createServer(createApp());
  const io = createSocketServer(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', resolve);
  });
  const address = httpServer.address();
  assert.ok(address && typeof address === 'object');

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    httpServer,
    io,
  };
}

async function stopServer(server: TestServer): Promise<void> {
  stopDisconnectedPlayerExpirySweep();
  stopExpiredAuthSessionCleanup();
  resetAbuseLimiterForTests();
  setSocketServer(null);
  server.io.close();

  if (server.httpServer.listening) {
    await new Promise<void>((resolve, reject) => {
      server.httpServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function createAdminCookie(): Promise<{ email: string; cookie: string }> {
  const suffix = uniqueSuffix();
  const email = `qa79.high-player.${suffix}@example.com`;
  const registered = await registerUser({
    email,
    password: 'password-ok',
    preferredDisplayName: `QA79-${suffix.slice(-8)}`,
  });
  assert.equal(registered.success, true, 'admin fixture account registers');
  await promoteExistingUserToAdmin(email);

  const login = await loginUser({
    email,
    password: 'password-ok',
  });
  assert.equal(login.success, true, 'promoted admin logs in');
  if (!login.success || !('session' in login)) {
    throw new Error('Promoted admin did not receive an authenticated session.');
  }
  const resolved = await resolveAuthSession(login.session.sessionToken, { requireAdminMfa: true });
  assert.equal(resolved?.role, 'ADMIN', 'fixture session resolves as an admin before Socket.IO');
  return {
    email,
    cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(login.session.sessionToken)}`,
  };
}

function newVirtualClient(name: string, socket: Socket): VirtualClient {
  return {
    name,
    socket,
    id: '',
    roomId: '',
    roomCode: '',
    reconnectToken: '',
    phases: [],
    navigations: [],
    navigationListenerAttached: false,
  };
}

function applySession(client: VirtualClient, session: RoomSessionData): void {
  client.id = session.player.id;
  client.roomId = session.room.id;
  client.roomCode = session.room.code;
  client.reconnectToken = session.reconnectToken ?? client.reconnectToken;
}

async function createAdminRoom(baseUrl: string, cookie: string): Promise<VirtualClient> {
  const socket = await connectSocket(baseUrl, cookie);
  const host = newVirtualClient(playerName(1), socket);
  attachStateListener(host);
  attachNavigationListener(host);

  const response = await ack<CreateRoomResponse>(host.socket, CREATE_ROOM_EVENT, {
    playerName: host.name,
  });
  assert.equal(response.success, true, 'authenticated admin creates a room over Socket.IO');
  if (!response.success) {
    throw new Error(response.error.message);
  }
  applySession(host, response.data);
  try {
    assert.equal(response.data.room.playerCap, ADMIN_ROOM_PLAYER_CAP);
    assert.equal(response.data.room.playerCap, 20);
    assert.ok(response.data.reconnectToken);
    return host;
  } catch (error) {
    host.socket.disconnect();
    await cleanupRoom(host.roomId);
    throw error;
  }
}

async function joinClient(
  baseUrl: string,
  host: VirtualClient,
  index: number,
  options: { trackNavigation?: boolean } = {},
): Promise<VirtualClient> {
  const socket = await connectSocket(baseUrl);
  const client = newVirtualClient(playerName(index), socket);
  attachStateListener(client);
  if (options.trackNavigation !== false) {
    attachNavigationListener(client);
  }

  const response = await ack<RoomActionResponse<RoomSessionData>>(client.socket, JOIN_ROOM_EVENT, {
    roomCode: host.roomCode,
    playerName: client.name,
  });
  assert.equal(response.success, true, `player ${index} joins over Socket.IO`);
  if (!response.success) {
    throw new Error(response.error.message);
  }
  assert.ok(response.data.reconnectToken);
  applySession(client, response.data);
  return client;
}

async function syncRoom(client: VirtualClient): Promise<RoomSessionData> {
  const response = await ack<RoomActionResponse<RoomSessionData>>(
    client.socket,
    ROOM_SYNC_EVENT,
    {},
  );
  assert.equal(response.success, true, `${client.name} room sync succeeds`);
  if (!response.success) {
    throw new Error(response.error.message);
  }
  return response.data;
}

async function syncShell(client: VirtualClient): Promise<GameShellState> {
  const response = await ack<GameActionResponse<{ state: GameShellState | null }>>(
    client.socket,
    GAME_SHELL_SYNC_EVENT,
    {},
  );
  assert.equal(response.success, true, `${client.name} shell sync succeeds`);
  if (!response.success || !response.data.state) {
    throw new Error(response.success ? 'Missing active shell' : response.error.message);
  }
  return response.data.state;
}

async function syncBara(client: VirtualClient): Promise<BaraAlSalafaPlayerView> {
  return syncPlugin<BaraAlSalafaPlayerView>(client, BARA_AL_SALAFA_SYNC_EVENT, 'Bara');
}

async function syncPlugin<T>(client: VirtualClient, event: string, gameName: string): Promise<T> {
  const response = await ack<GameActionResponse<{ view: T }>>(client.socket, event, {});
  assert.equal(response.success, true, `${client.name} ${gameName} sync succeeds`);
  if (!response.success) {
    throw new Error(response.error.message);
  }
  return response.data.view;
}

async function syncDrawGuess(client: VirtualClient): Promise<DrawGuessPlayerView> {
  return syncPlugin<DrawGuessPlayerView>(client, DRAW_GUESS_SYNC_EVENT, 'Draw & Guess');
}

async function syncImposterDraw(client: VirtualClient): Promise<ImposterDrawPlayerView> {
  return syncPlugin<ImposterDrawPlayerView>(client, IMPOSTER_DRAW_SYNC_EVENT, 'Imposter Draw');
}

async function syncTimingChallenge(client: VirtualClient): Promise<TimingChallengePlayerView> {
  return syncPlugin<TimingChallengePlayerView>(client, TIMING_CHALLENGE_SYNC_EVENT, 'Timing');
}

async function syncFastAnswer(client: VirtualClient): Promise<FastAnswerPlayerView> {
  return syncPlugin<FastAnswerPlayerView>(client, FAST_ANSWER_SYNC_EVENT, 'Fast Answer');
}

async function syncWhoWroteIt(client: VirtualClient): Promise<WhoWroteItPlayerView> {
  return syncPlugin<WhoWroteItPlayerView>(client, WHO_WROTE_IT_SYNC_EVENT, 'Who Wrote It');
}

async function syncJudge(client: VirtualClient): Promise<JudgePlayerView> {
  return syncPlugin<JudgePlayerView>(client, JUDGE_SYNC_EVENT, 'Judge');
}

async function assertRosterCheckpoint(clients: VirtualClient[], count: number): Promise<void> {
  assert.equal(clients.length, count);
  const expectedIds = new Set(clients.map((client) => client.id));
  assert.equal(expectedIds.size, count, `${count} unique local player identities`);
  assert.ok(
    clients.every((client) => client.socket.connected),
    `${count} sockets connected`,
  );

  const sessions = await Promise.all(clients.map(syncRoom));
  for (const [index, session] of sessions.entries()) {
    assert.equal(session.player.id, clients[index]!.id, 'socket remains bound to its identity');
    assert.equal(session.players.length, count, `${count}-player authoritative roster`);
    assert.deepEqual(
      new Set(session.players.map((player) => player.id)),
      expectedIds,
      'every client converges on the same unique roster',
    );
  }
  console.log(`PASS admin-capacity roster checkpoint ${count}/20`);
}

async function reconnectClient(
  baseUrl: string,
  client: VirtualClient,
  options: { trackNavigation?: boolean } = {},
): Promise<void> {
  client.socket.removeAllListeners();
  client.socket.disconnect();

  const replacement = await connectSocket(baseUrl);
  prepareReplacementSocket(client, replacement, options);
  await submitReconnect(client);
}

function prepareReplacementSocket(
  client: VirtualClient,
  replacement: Socket,
  options: { trackNavigation?: boolean } = {},
): void {
  client.socket = replacement;
  client.navigationListenerAttached = false;
  attachStateListener(client);
  if (options.trackNavigation !== false) {
    attachNavigationListener(client);
  }
}

async function submitReconnect(client: VirtualClient): Promise<void> {
  const originalId = client.id;
  const response = await ack<ReconnectResponse>(client.socket, RECONNECT_EVENT, {
    playerId: client.id,
    roomId: client.roomId,
    roomCode: client.roomCode,
    reconnectToken: client.reconnectToken,
  });
  assert.equal(response.success, true, `${client.name} reconnects with its credential`);
  if (!response.success) {
    throw new Error(response.error.message);
  }
  applySession(client, response.data);
  assert.equal(client.id, originalId, 'reconnect preserves the exact player identity');
}

function assertExactIds(
  actual: readonly string[],
  expected: readonly string[],
  label: string,
): void {
  assert.equal(actual.length, expected.length, `${label} count`);
  assert.equal(new Set(actual).size, actual.length, `${label} has no duplicates`);
  assert.deepEqual(new Set(actual), new Set(expected), label);
}

async function cleanupRoom(
  roomId: string,
  gameId: string | null = BARA_AL_SALAFA_GAME_ID,
): Promise<void> {
  const row = await prisma.room.findUnique({
    where: { id: roomId },
    select: { historyId: true },
  });
  cleanupGameShellRuntime(roomId);
  cleanupPluginMatchState(roomId, gameId);
  deleteGameShell(roomId);
  await prisma.match.deleteMany({ where: { roomId } }).catch(() => undefined);
  await prisma.room.deleteMany({ where: { id: roomId } }).catch(() => undefined);
  if (row?.historyId) {
    await prisma.roomHistory.deleteMany({ where: { id: row.historyId } }).catch(() => undefined);
  }
}

type ParticipantMatchState = {
  playerIds: string[];
};

type TenPlayerContext = {
  roomId: string;
  clients: VirtualClient[];
  participantIds: string[];
};

type TenPlayerScenario = {
  label: string;
  gameId: string;
  startPayload?: (clients: VirtualClient[]) => Record<string, unknown>;
  syncInitial: (client: VirtualClient) => Promise<unknown>;
  getMatchState: (roomId: string) => ParticipantMatchState | null;
  exercise: (context: TenPlayerContext, baseUrl: string) => Promise<void>;
};

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

async function assertTenPlayerMembership(
  context: TenPlayerContext,
  scenario: Pick<TenPlayerScenario, 'gameId' | 'getMatchState'>,
): Promise<void> {
  const shells = await Promise.all(context.clients.map(syncShell));
  for (const shell of shells) {
    assert.equal(shell.phase, 'PLAYING', `${scenario.gameId} shell remains PLAYING`);
    assert.equal(shell.gameId, scenario.gameId, `${scenario.gameId} shell keeps its game id`);
    assertExactIds(
      shell.matchParticipantIds ?? [],
      context.participantIds,
      `${scenario.gameId} shell has the exact 10-player lock`,
    );
  }

  const match = scenario.getMatchState(context.roomId);
  assert.ok(match, `${scenario.gameId} match runtime exists`);
  assertExactIds(
    match.playerIds,
    context.participantIds,
    `${scenario.gameId} match has the exact 10-player membership`,
  );
}

async function runTenPlayerScenario(
  baseUrl: string,
  adminCookie: string,
  scenario: TenPlayerScenario,
): Promise<void> {
  resetAbuseLimiterForTests();
  let roomId = '';
  const clients: VirtualClient[] = [];

  try {
    const host = await createAdminRoom(baseUrl, adminCookie);
    roomId = host.roomId;
    clients.push(host);

    for (let index = 2; index <= 10; index += 1) {
      clients.push(await joinClient(baseUrl, host, index));
    }
    await assertRosterCheckpoint(clients, 10);

    const participantIds = clients.map((client) => client.id);
    const start = await ack<GameActionResponse<{ state: GameShellState }>>(
      host.socket,
      GAME_SHELL_START_FROM_LOBBY_EVENT,
      {
        gameId: scenario.gameId,
        ...(scenario.startPayload?.(clients) ?? {}),
      },
    );
    assert.equal(start.success, true, `${scenario.label} starts with 10 players`);
    if (!start.success) {
      throw new Error(start.error.message);
    }
    assert.equal(start.data.state.phase, 'WAITING');
    assertExactIds(
      start.data.state.matchParticipantIds ?? [],
      participantIds,
      `${scenario.label} locks all 10 players at start`,
    );

    await waitFor(() => host.phases.includes('PLAYING'), `${scenario.label} reaches PLAYING`);
    await scenario.syncInitial(host);
    await waitFor(
      () => scenario.getMatchState(roomId) !== null,
      `${scenario.label} initializes its match runtime`,
    );

    const context = { roomId, clients, participantIds };
    await assertTenPlayerMembership(context, scenario);
    await scenario.exercise(context, baseUrl);
    await assertTenPlayerMembership(context, scenario);
    console.log(`PASS QA-79 ${scenario.label} 10-player action and reconnect recovery`);
  } finally {
    for (const client of clients) {
      client.socket.removeAllListeners();
      client.socket.disconnect();
    }
    if (roomId) {
      await cleanupRoom(roomId, scenario.gameId);
    }
  }
}

async function runHighPlayerScenario(
  baseUrl: string,
  adminCookie: string,
  onRoomCreated: (roomId: string, clients: VirtualClient[]) => void,
): Promise<{ roomId: string; clients: VirtualClient[] }> {
  const clients: VirtualClient[] = [await createAdminRoom(baseUrl, adminCookie)];
  const host = clients[0]!;
  onRoomCreated(host.roomId, clients);
  const missedNavigationIndexes = new Set([17, 18]);

  for (const checkpoint of PLAYER_CHECKPOINTS) {
    for (let index = clients.length + 1; index <= checkpoint; index += 1) {
      clients.push(
        await joinClient(baseUrl, host, index, {
          trackNavigation: !missedNavigationIndexes.has(index),
        }),
      );
    }
    await assertRosterCheckpoint(clients, checkpoint);
  }

  const rejectedSocket = await connectSocket(baseUrl);
  const rejected = newVirtualClient(playerName(21), rejectedSocket);
  attachStateListener(rejected);
  attachNavigationListener(rejected);
  const fullResponse = await ack<RoomActionResponse<RoomSessionData>>(
    rejected.socket,
    JOIN_ROOM_EVENT,
    { roomCode: host.roomCode, playerName: rejected.name },
  );
  assert.equal(fullResponse.success, false, '21st active player is rejected');
  if (!fullResponse.success) {
    assert.equal(fullResponse.error.code, 'ROOM_FULL');
  }
  console.log('PASS 21st player rejected at admin room cap');

  for (const client of clients) {
    client.phases.length = 0;
    client.navigations.length = 0;
  }

  // Fault A: make the transport loss authoritative before Start. The active
  // room seat is still inside reconnect grace and must be included in the
  // accepted match membership even though it is not currently connected.
  const waitingReconnect = clients[4]!;
  waitingReconnect.socket.removeAllListeners();
  waitingReconnect.socket.disconnect();
  await waitFor(async () => {
    const player = await prisma.player.findUnique({
      where: { id: waitingReconnect.id },
      select: { status: true },
    });
    return player?.status === PlayerStatus.DISCONNECTED;
  }, 'pre-start player to become DISCONNECTED');
  const waitingReplacement = await connectSocket(baseUrl);

  const start = await ack<GameActionResponse<{ state: GameShellState }>>(
    host.socket,
    GAME_SHELL_START_FROM_LOBBY_EVENT,
    { gameId: BARA_AL_SALAFA_GAME_ID },
  );
  assert.equal(start.success, true, 'host starts Bara over Socket.IO');
  if (!start.success) {
    throw new Error(start.error.message);
  }
  assert.equal(start.data.state.phase, 'WAITING');
  assertExactIds(
    start.data.state.matchParticipantIds ?? [],
    clients.map((client) => client.id),
    'accepted shell membership is locked at start',
  );

  prepareReplacementSocket(waitingReconnect, waitingReplacement);
  await submitReconnect(waitingReconnect);
  const waitingRecoveredShell = await syncShell(waitingReconnect);
  assert.equal(
    waitingRecoveredShell.phase,
    'WAITING',
    'client disconnected before Start reconnects during WAITING',
  );
  assertExactIds(
    waitingRecoveredShell.matchParticipantIds ?? [],
    clients.map((client) => client.id),
    'WAITING reconnect preserves locked membership',
  );

  await waitFor(() => host.phases.includes('COUNTDOWN'), 'the authoritative COUNTDOWN broadcast');

  // Wait until the shell has advanced before reattaching these listeners, so
  // this models a client that completely dropped the earlier one-shot event.
  const missedNavigationClients = [
    waitingReconnect,
    ...clients.filter((_, index) => missedNavigationIndexes.has(index + 1)),
  ];
  for (const client of missedNavigationClients.filter((client) => client !== waitingReconnect)) {
    attachNavigationListener(client);
  }

  const countdownReconnect = clients[5]!;
  await reconnectClient(baseUrl, countdownReconnect);
  const countdownRecoveredShell = await syncShell(countdownReconnect);
  assert.ok(
    countdownRecoveredShell.phase === 'COUNTDOWN' || countdownRecoveredShell.phase === 'PLAYING',
    'countdown reconnect recovers the active shell',
  );
  assertExactIds(
    countdownRecoveredShell.matchParticipantIds ?? [],
    clients.map((client) => client.id),
    'COUNTDOWN reconnect preserves locked membership',
  );

  await waitFor(() => host.phases.includes('PLAYING'), 'the authoritative PLAYING broadcast');
  await waitFor(() => getBaraAlSalafaState(host.roomId) !== null, 'Bara plugin initialization');

  assert.ok(
    clients
      .filter((client) => !missedNavigationClients.includes(client))
      .every((client) => client.navigations.includes('/game')),
    'clients listening to the low-latency navigation event receive /game',
  );
  assert.ok(
    missedNavigationClients.every((client) => client.navigations.length === 0),
    'selected clients completely miss the one-shot navigation event',
  );

  const shells = await Promise.all(clients.map(syncShell));
  const participantIds = clients.map((client) => client.id);
  for (const shell of shells) {
    assert.equal(shell.phase, 'PLAYING');
    assert.equal(shell.gameId, BARA_AL_SALAFA_GAME_ID);
    assertExactIds(shell.matchParticipantIds ?? [], participantIds, 'synced shell membership');
  }

  const match = getBaraAlSalafaState(host.roomId);
  assert.ok(match, 'Bara match state exists');
  assertExactIds(match.playerIds, participantIds, 'Bara match membership equals shell membership');

  const views = await Promise.all(clients.map(syncBara));
  const impostorIndexes = views
    .map((view, index) => (view.role === 'impostor' ? index : -1))
    .filter((index) => index >= 0);
  assert.equal(impostorIndexes.length, 1, 'exactly one impostor among 20 participants');
  assert.equal(
    views.filter((view) => view.role === 'player').length,
    19,
    'exactly 19 civilians among 20 participants',
  );
  assert.ok(
    views.every((view) => !view.isMatchSpectator),
    'all locked players are participants',
  );
  assert.ok(
    views.every((view) => view.displayText.length > 0),
    'every participant has a private projection',
  );
  assert.ok(
    views.every((view) => view.revealedImpostorPlayerId === null),
    'private sync does not publicly reveal the impostor identity',
  );
  const civilianWords = new Set(
    views.filter((view) => view.role === 'player').map((view) => view.displayText),
  );
  assert.equal(civilianWords.size, 1, 'all civilians receive the same private word');

  for (const client of missedNavigationClients) {
    const recoveredShell = await syncShell(client);
    const recoveredView = await syncBara(client);
    assert.equal(recoveredShell.phase, 'PLAYING');
    assert.ok(recoveredView.displayText.length > 0);
    assert.equal(client.navigations.length, 0, 'authoritative recovery does not depend on replay');
  }
  console.log('PASS 20-player missed-navigation clients converge by authoritative sync');

  const refreshed = clients[6]!;
  const roleBeforeRefresh = views[6]!.role;
  const displayBeforeRefresh = views[6]!.displayText;
  await reconnectClient(baseUrl, refreshed);
  const refreshedShell = await syncShell(refreshed);
  const refreshedView = await syncBara(refreshed);
  assert.equal(refreshedShell.phase, 'PLAYING');
  assert.equal(
    refreshedView.role,
    roleBeforeRefresh,
    'recreated socket preserves the private role',
  );
  assert.equal(
    refreshedView.displayText,
    displayBeforeRefresh,
    'recreated socket preserves the exact private role projection',
  );
  assertExactIds(
    refreshedShell.matchParticipantIds ?? [],
    participantIds,
    'post-PLAYING reconnect preserves shell membership',
  );
  console.log('PASS post-PLAYING socket recreation preserves identity and private role');

  // Free one live room seat only after all 20-player membership assertions.
  // A new join during PLAYING must be a spectator and receive no private word.
  const departing = clients[clients.length - 1]!;
  const leave = await ack<RoomActionResponse<unknown>>(departing.socket, LEAVE_ROOM_EVENT, {});
  assert.equal(leave.success, true, 'participant can leave permanently');
  departing.socket.disconnect();

  const spectatorJoin = await ack<RoomActionResponse<RoomSessionData>>(
    rejected.socket,
    JOIN_ROOM_EVENT,
    { roomCode: host.roomCode, playerName: rejected.name },
  );
  assert.equal(spectatorJoin.success, true, 'freed room seat can join during PLAYING');
  if (!spectatorJoin.success) {
    throw new Error(spectatorJoin.error.message);
  }
  applySession(rejected, spectatorJoin.data);
  assert.equal(spectatorJoin.data.player.isSpectator, true);
  const spectatorShell = await syncShell(rejected);
  assert.ok(!spectatorShell.matchParticipantIds?.includes(rejected.id));
  const spectatorView = await syncBara(rejected);
  assert.equal(spectatorView.isMatchSpectator, true);
  assert.equal(spectatorView.displayText, '');
  assert.equal(spectatorView.spectatorCivilianWord, null);
  assert.equal(spectatorView.spectatorOutsiderConcept, null);
  assert.equal(spectatorView.revealedWord, null);
  assert.equal(spectatorView.revealedImpostorPlayerId, null);
  console.log('PASS late spectator receives no private Bara secrets');

  clients.push(rejected);
  return { roomId: host.roomId, clients };
}

async function runCrossGameTenPlayerScenarios(baseUrl: string, adminCookie: string): Promise<void> {
  await runTenPlayerScenario(baseUrl, adminCookie, {
    label: 'Draw & Guess',
    gameId: DRAW_GUESS_GAME_ID,
    startPayload: ([host]) => ({
      drawGuess: { drawerMode: 'fixed', fixedPlayerId: host!.id },
    }),
    syncInitial: syncDrawGuess,
    getMatchState: getDrawGuessState,
    exercise: async ({ clients, roomId }, scenarioBaseUrl) => {
      const views = await Promise.all(clients.map(syncDrawGuess));
      const drawer = clients[0]!;
      const drawerView = views[0]!;
      const secretWord = drawerView.secretWord;

      assert.equal(drawerView.role, 'drawer', 'configured fixed drawer keeps the drawer role');
      assert.ok(secretWord, 'fixed drawer receives its private word');
      assert.equal(
        views.filter((view) => view.role === 'drawer').length,
        1,
        'exactly one drawer among 10 players',
      );
      assert.ok(
        views.slice(1).every((view) => view.role === 'guesser' && view.secretWord === null),
        'all nine guessers are denied the private word',
      );

      const stroke = await ack<GameActionResponse<{ ok: boolean }>>(
        drawer.socket,
        DRAW_GUESS_STROKE_EVENT,
        sampleStroke(drawerView.turnId, 'qa79-draw-10-player-stroke'),
      );
      assert.equal(stroke.success, true, 'the 10-player drawer can perform a valid stroke');
      assert.equal(getDrawGuessState(roomId)?.round.strokes.length, 1, 'drawer stroke is retained');

      await reconnectClient(scenarioBaseUrl, drawer);
      const recovered = await syncDrawGuess(drawer);
      assert.equal(recovered.role, 'drawer', 'drawer reconnect retains the exact role');
      assert.equal(recovered.secretWord, secretWord, 'drawer reconnect retains the private word');
    },
  });

  await runTenPlayerScenario(baseUrl, adminCookie, {
    label: 'Imposter Draw',
    gameId: IMPOSTER_DRAW_GAME_ID,
    syncInitial: syncImposterDraw,
    getMatchState: getImposterDrawState,
    exercise: async ({ clients, roomId }, scenarioBaseUrl) => {
      const briefingViews = await Promise.all(clients.map(syncImposterDraw));
      const impostorIndex = briefingViews.findIndex((view) => view.role === 'impostor');
      assert.ok(impostorIndex >= 0, 'one Imposter Draw player is assigned impostor');
      assert.equal(
        briefingViews.filter((view) => view.role === 'impostor' && view.referenceImage === null)
          .length,
        1,
        'only the impostor is denied the reference image',
      );
      assert.equal(
        briefingViews.filter((view) => view.role === 'crew' && view.referenceImage !== null).length,
        9,
        'all nine crew receive a private reference image',
      );

      for (const client of clients) {
        const acknowledged = await ack<GameActionResponse<{ view: ImposterDrawPlayerView }>>(
          client.socket,
          IMPOSTER_DRAW_SUBMIT_ROLE_UNDERSTOOD_EVENT,
          {},
        );
        assert.equal(
          acknowledged.success,
          true,
          `${client.name} acknowledges the private briefing`,
        );
      }
      await waitFor(
        () => getImposterDrawState(roomId)?.round.gamePhase === 'drawing-turns',
        'Imposter Draw moves all 10 acknowledged players to drawing turns',
      );

      const drawingViews = await Promise.all(clients.map(syncImposterDraw));
      const drawerIndex = drawingViews.findIndex((view) => view.canDraw);
      assert.ok(drawerIndex >= 0, 'one eligible Imposter Draw player can draw');
      const drawer = clients[drawerIndex]!;
      const drawerView = drawingViews[drawerIndex]!;
      assertExactIds(
        getImposterDrawState(roomId)?.round.drawingOrder ?? [],
        clients.map((client) => client.id),
        'Imposter Draw drawing order contains the exact 10-player membership',
      );
      const stroke = await ack<GameActionResponse<{ ok: boolean }>>(
        drawer.socket,
        IMPOSTER_DRAW_STROKE_EVENT,
        sampleStroke(drawerView.turnId, 'qa79-imposter-10-player-stroke'),
      );
      assert.equal(stroke.success, true, 'the selected Imposter Draw participant can draw');
      assert.equal(
        getImposterDrawState(roomId)?.round.strokes.length,
        1,
        'Imposter Draw stroke is retained',
      );

      const impostor = clients[impostorIndex]!;
      await reconnectClient(scenarioBaseUrl, impostor);
      const recovered = await syncImposterDraw(impostor);
      assert.equal(recovered.role, 'impostor', 'impostor reconnect retains the private role');
      assert.equal(
        recovered.referenceImage,
        null,
        'impostor reconnect is never given the reference image',
      );
    },
  });

  await runTenPlayerScenario(baseUrl, adminCookie, {
    label: 'Timing Challenge',
    gameId: TIMING_CHALLENGE_GAME_ID,
    startPayload: () => ({
      timingChallenge: { mode: 'guess-time', minSeconds: 3, maxSeconds: 5 },
    }),
    syncInitial: syncTimingChallenge,
    getMatchState: getTimingChallengeState,
    exercise: async ({ clients, roomId }, scenarioBaseUrl) => {
      const readyViews = await Promise.all(clients.map(syncTimingChallenge));
      const roundId = readyViews[0]!.roundId;
      assert.equal(readyViews[0]!.gamePhase, 'ready', 'Timing Challenge starts in ready phase');
      assert.ok(
        readyViews.every(
          (view) => view.peers.length === 10 && view.targetMs === null && !view.isMatchSpectator,
        ),
        'all 10 Timing players see the exact peer set without the hidden target',
      );

      for (const client of clients) {
        const ready = await ack<GameActionResponse<{ view: TimingChallengePlayerView }>>(
          client.socket,
          TIMING_CHALLENGE_READY_EVENT,
          { roundId },
        );
        assert.equal(ready.success, true, `${client.name} readies for the timing round`);
      }
      await waitFor(
        () => getTimingChallengeState(roomId)?.round.gamePhase === 'guessing',
        'the hidden 10-player timing round reaches guessing',
      );

      const guesser = clients[1]!;
      const guessingView = await syncTimingChallenge(guesser);
      assert.equal(guessingView.targetMs, null, 'the target remains hidden during guessing');
      const guess = await ack<GameActionResponse<{ view: TimingChallengePlayerView }>>(
        guesser.socket,
        TIMING_CHALLENGE_SUBMIT_GUESS_EVENT,
        { roundId: guessingView.roundId, guessSeconds: 4 },
      );
      assert.equal(guess.success, true, 'one 10-player timing guess is accepted');
      if (!guess.success) {
        throw new Error(guess.error.message);
      }
      assert.equal(guess.data.view.selfGuessMs, 4_000, 'submitter sees only its recorded guess');
      const observer = await syncTimingChallenge(clients[2]!);
      assert.equal(observer.selfGuessMs, null, 'another player cannot see the submitter guess');

      await reconnectClient(scenarioBaseUrl, guesser);
      const recovered = await syncTimingChallenge(guesser);
      assert.equal(
        recovered.selfGuessMs,
        4_000,
        'timing reconnect retains only the submitter state',
      );
    },
  });

  await runTenPlayerScenario(baseUrl, adminCookie, {
    label: 'Fast Answer',
    gameId: FAST_ANSWER_GAME_ID,
    syncInitial: syncFastAnswer,
    getMatchState: getFastAnswerState,
    exercise: async ({ clients, roomId }, scenarioBaseUrl) => {
      const views = await Promise.all(clients.map(syncFastAnswer));
      const submitter = clients[1]!;
      const submitterView = views[1]!;
      const answer = getFastAnswerState(roomId)?.round.acceptedAnswers[0];

      assert.equal(submitterView.gamePhase, 'question', 'Fast Answer begins with a question');
      assert.ok(submitterView.roundId, 'Fast Answer question has a round id');
      assert.ok(answer, 'Fast Answer test content supplies an accepted answer');
      assert.ok(
        views.every(
          (view) =>
            view.revealedAnswer === null &&
            view.winnerPlayerId === null &&
            !view.hasAnsweredCorrectly,
        ),
        'Fast Answer private views do not reveal answers before a submission',
      );

      const answerResult = await ack<
        GameActionResponse<{ correct: boolean; view: FastAnswerPlayerView }>
      >(submitter.socket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, {
        answer,
        roundId: submitterView.roundId,
      });
      assert.equal(answerResult.success, true, 'a correct Fast Answer response is accepted');
      if (!answerResult.success) {
        throw new Error(answerResult.error.message);
      }
      assert.equal(answerResult.data.correct, true, 'correct Fast Answer response is recognized');
      assert.equal(
        answerResult.data.view.correctAnswerPlacement,
        1,
        'first answer receives placement one',
      );
      assert.equal(
        answerResult.data.view.correctAnswerPoints,
        100,
        'first answer receives 100 points',
      );
      const observer = await syncFastAnswer(clients[2]!);
      assert.equal(
        observer.hasAnsweredCorrectly,
        false,
        'other players do not inherit the answer state',
      );
      assert.equal(observer.correctAnswerPlacement, null, 'other players do not inherit placement');

      await reconnectClient(scenarioBaseUrl, submitter);
      const recovered = await syncFastAnswer(submitter);
      assert.equal(
        recovered.hasAnsweredCorrectly,
        true,
        'Fast Answer reconnect retains the answer state',
      );
      assert.equal(recovered.correctAnswerPlacement, 1, 'Fast Answer reconnect retains placement');
      assert.equal(recovered.correctAnswerPoints, 100, 'Fast Answer reconnect retains points');
    },
  });

  await runTenPlayerScenario(baseUrl, adminCookie, {
    label: 'Who Wrote It',
    gameId: WHO_WROTE_IT_GAME_ID,
    syncInitial: syncWhoWroteIt,
    getMatchState: getWhoWroteItState,
    exercise: async ({ clients }, scenarioBaseUrl) => {
      const views = await Promise.all(clients.map(syncWhoWroteIt));
      const submitter = clients[1]!;
      const submitterView = views[1]!;
      assert.equal(submitterView.gamePhase, 'answering', 'Who Wrote It begins in answering');
      assert.ok(submitterView.roundId, 'Who Wrote It has a round id');
      assert.equal(
        submitterView.currentAnonymousAnswer,
        null,
        'answer owners remain hidden while answering',
      );
      assert.deepEqual(submitterView.revealEntries, [], 'answer ownership is not revealed early');

      const submitted = await ack<GameActionResponse<{ view: WhoWroteItPlayerView }>>(
        submitter.socket,
        WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
        { answer: 'qa79 ten-player answer', roundId: submitterView.roundId },
      );
      assert.equal(submitted.success, true, 'one Who Wrote It answer is accepted');
      if (!submitted.success) {
        throw new Error(submitted.error.message);
      }
      assert.equal(
        submitted.data.view.hasSubmittedAnswer,
        true,
        'submitter sees its own submission',
      );
      const observer = await syncWhoWroteIt(clients[2]!);
      assert.equal(observer.hasSubmittedAnswer, false, 'other player has not submitted');
      assert.equal(
        observer.currentAnonymousAnswer,
        null,
        'other player cannot see ownership early',
      );
      assert.deepEqual(observer.revealEntries, [], 'other player receives no reveal mapping');

      await reconnectClient(scenarioBaseUrl, submitter);
      const recovered = await syncWhoWroteIt(submitter);
      assert.equal(recovered.hasSubmittedAnswer, true, 'Who Wrote It reconnect retains the answer');
      assert.equal(
        recovered.currentAnonymousAnswer,
        null,
        'reconnect does not expose answer ownership',
      );
    },
  });

  await runTenPlayerScenario(baseUrl, adminCookie, {
    label: 'Judge',
    gameId: JUDGE_GAME_ID,
    syncInitial: syncJudge,
    getMatchState: getJudgeState,
    exercise: async ({ clients }, scenarioBaseUrl) => {
      const views = await Promise.all(clients.map(syncJudge));
      const judgeIndexes = views
        .map((view, index) => (view.isJudge ? index : -1))
        .filter((index) => index >= 0);
      assert.equal(judgeIndexes.length, 1, 'exactly one Judge player is assigned judge');
      const submitterIndex = views.findIndex((view) => !view.isJudge);
      assert.ok(submitterIndex >= 0, 'a non-judge participant can submit an answer');
      const submitter = clients[submitterIndex]!;
      const submitterView = views[submitterIndex]!;
      assert.equal(submitterView.gamePhase, 'answering', 'Judge begins in answering');
      assert.ok(submitterView.roundId, 'Judge has a round id');
      assert.ok(
        views.every((view) => view.anonymousAnswers.length === 0 && !view.canSelectWinner),
        'Judge hides answer ownership until judging',
      );

      const submitted = await ack<GameActionResponse<{ view: JudgePlayerView }>>(
        submitter.socket,
        JUDGE_SUBMIT_ANSWER_EVENT,
        { answer: 'qa79 ten-player judgment', roundId: submitterView.roundId },
      );
      assert.equal(submitted.success, true, 'one non-judge answer is accepted');
      if (!submitted.success) {
        throw new Error(submitted.error.message);
      }
      assert.equal(
        submitted.data.view.hasSubmittedAnswer,
        true,
        'Judge submitter sees its submission',
      );
      const judgeView = await syncJudge(clients[judgeIndexes[0]!]!);
      assert.equal(
        judgeView.anonymousAnswers.length,
        0,
        'judge does not see answers before judging',
      );

      await reconnectClient(scenarioBaseUrl, submitter);
      const recovered = await syncJudge(submitter);
      assert.equal(
        recovered.hasSubmittedAnswer,
        true,
        'Judge reconnect retains the submitted answer',
      );
      assert.equal(recovered.isJudge, false, 'Judge reconnect retains the non-judge role');
    },
  });
}

async function main(): Promise<void> {
  const server = await startServer();
  console.log('PASS QA-79 local Socket.IO server started');
  let adminEmail = '';
  let roomId = '';
  let clients: VirtualClient[] = [];

  try {
    const admin = await createAdminCookie();
    adminEmail = admin.email;
    console.log('PASS QA-79 isolated admin fixture authenticated');
    const result = await runHighPlayerScenario(
      server.baseUrl,
      admin.cookie,
      (nextRoomId, nextClients) => {
        roomId = nextRoomId;
        clients = nextClients;
      },
    );
    roomId = result.roomId;
    clients = result.clients;
    console.log('PASS QA-79 20-player Socket.IO convergence and recovery');
    await runCrossGameTenPlayerScenarios(server.baseUrl, admin.cookie);
    console.log('PASS QA-79 cross-game 10-player membership, action, and reconnect recovery');
  } finally {
    for (const client of clients) {
      client.socket.removeAllListeners();
      client.socket.disconnect();
    }
    if (roomId) {
      await cleanupRoom(roomId);
    }
    if (adminEmail) {
      await prisma.user.deleteMany({ where: { email: adminEmail } }).catch(() => undefined);
    }
    await stopServer(server);
    await prisma.$disconnect();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
    process.exit(1);
  },
);
