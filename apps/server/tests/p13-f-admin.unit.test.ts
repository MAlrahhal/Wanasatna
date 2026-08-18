/**
 * P13-F — global game availability enable/disable.
 * Run: pnpm --filter @wanasatna/server test:p13-f
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { io as ioClient, type Socket } from 'socket.io-client';
import { MatchStatus } from '@prisma/client';
import {
  CREATE_ROOM_EVENT,
  GAME_DISABLED_MESSAGE,
  GAME_SHELL_INIT_EVENT,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
  PLAYABLE_GAME_IDS,
  TIMING_CHALLENGE_GAME_ID,
  sanitizeRoomGameSettings,
  type AdminActionResponse,
  type AdminGamesData,
  type CreateRoomResponse,
  type GameActionResponse,
  type GameAvailabilityData,
} from '@wanasatna/shared';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { setSocketServer } from '../src/lib/socket-server.js';
import { promoteExistingUserToAdmin } from '../src/modules/admin/promote-existing-user.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { stopExpiredAuthSessionCleanup } from '../src/modules/auth/auth-session-cleanup.js';
import { registerUser } from '../src/modules/auth/auth.service.js';
import { registerAllGameContent } from '../src/modules/content/index.js';
import {
  deleteGameShell,
  getGameShellByRoomId,
  startGameShellFromLobby,
} from '../src/modules/game/game.service.js';
import {
  invalidateGameAvailabilityCache,
  isGameEnabled,
  setGameEnabled,
} from '../src/modules/game/game-availability.service.js';
import { registerAllGamePlugins } from '../src/modules/game/plugins/index.js';
import {
  beginPersistedMatch,
  completePersistedMatch,
} from '../src/modules/match/match-history.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import { createSocketServer } from '../src/sockets/index.js';
import { stopDisconnectedPlayerExpirySweep } from '../src/modules/room/services/disconnected-player-expiry.service.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

registerAllGameContent();
registerAllGamePlugins();

let passed = 0;
let failed = 0;

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
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

function uniqueEmail(prefix: string): string {
  return `p13f.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
}

function uniqueName(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 900 + 100)}`;
}

async function cleanupEmail(email: string): Promise<void> {
  await prisma.user.deleteMany({ where: { email } }).catch(() => undefined);
}

async function cleanupRoom(roomId: string | undefined): Promise<void> {
  if (!roomId) {
    return;
  }
  deleteGameShell(roomId);
  await prisma.match.deleteMany({ where: { roomId } }).catch(() => undefined);
  await prisma.room.deleteMany({ where: { id: roomId } }).catch(() => undefined);
}

async function resetAvailability(): Promise<void> {
  await prisma.gameAdminConfig.deleteMany();
  invalidateGameAvailabilityCache();
}

async function registerAccount(prefix: string) {
  const email = uniqueEmail(prefix);
  const registered = await registerUser({
    email,
    password: 'password-ok',
    preferredDisplayName: uniqueName('اسم'),
  });
  assert.equal(registered.success, true);
  if (!registered.success || !registered.session) {
    throw new Error('register failed');
  }
  return { email, user: registered.session.user, sessionToken: registered.session.sessionToken };
}

function cookieFromResponse(response: Response): string {
  const cookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie') ?? ''];
  return cookies
    .filter((value) => value.startsWith(`${AUTH_COOKIE_NAME}=`))
    .map((value) => value.split(';')[0] ?? '')
    .join('; ');
}

async function loginCookie(baseUrl: string, email: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'password-ok' }),
  });
  assert.equal(response.status, 200);
  return cookieFromResponse(response);
}

async function jsonRequest<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: AdminActionResponse<T>; raw: string }> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const raw = await response.text();
  const body = JSON.parse(raw) as AdminActionResponse<T>;
  return { status: response.status, body, raw };
}

function ack<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.timeout(15000).emit(event, payload, (err: Error | null, res: T) =>
      err ? reject(err) : resolve(res),
    );
  });
}

async function connectClient(url: string, cookie?: string): Promise<Socket> {
  const socket = ioClient(url, {
    autoConnect: true,
    withCredentials: true,
    extraHeaders: cookie ? { cookie } : undefined,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}

async function withApp<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  resetAuthRateLimiterForTests();
  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function withSocketServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  resetAuthRateLimiterForTests();
  setSocketServer(null);
  const app = createApp();
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => resolve());
  });
  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    stopDisconnectedPlayerExpirySweep();
    stopExpiredAuthSessionCleanup();
    setSocketServer(null);
    io.close();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function twoPlayerRoom() {
  const host = await createRoom({ playerName: uniqueName('مضيف') });
  assert.equal(host.success, true);
  if (!host.success) {
    throw new Error(host.error.message);
  }
  const guest = await joinRoom({ roomCode: host.data.room.code, playerName: uniqueName('ضيف') });
  assert.equal(guest.success, true);
  return { roomId: host.data.room.id, hostPlayerId: host.data.player.id };
}

async function main(): Promise<void> {
  resetAuthRateLimiterForTests();
  await resetAvailability();

  await test('source: additive GameAdminConfig; requireAdmin; start gate', () => {
    const schema = read('prisma/schema.prisma');
    const migration = read('prisma/migrations/20260817190000_add_game_admin_config/migration.sql');
    const routes = read('src/modules/admin/admin.routes.ts');
    const start = read('src/modules/game/game.service.ts');
    assert.match(schema, /model GameAdminConfig/);
    assert.match(migration, /CREATE TABLE "GameAdminConfig"/);
    assert.doesNotMatch(migration, /DROP /);
    assert.match(routes, /get\('\/games', requireAdmin/);
    assert.match(routes, /patch\('\/games\/:gameId', requireAdmin/);
    assert.match(start, /rejectIfGameDisabled/);
    assert.match(start, /GAME_DISABLED/);
  });

  await test('1 missing config row → game enabled', async () => {
    await resetAvailability();
    for (const gameId of PLAYABLE_GAME_IDS) {
      assert.equal(await isGameEnabled(gameId), true);
    }
  });

  await test('16 all 8 defaults enabled via public GET', async () => {
    await resetAvailability();
    await withApp(async (baseUrl) => {
      const listed = await jsonRequest<GameAvailabilityData>(baseUrl, '/api/games/availability');
      assert.equal(listed.status, 200);
      assert.equal(listed.body.success, true);
      if (listed.body.success) {
        assert.equal(listed.body.data.games.length, 8);
        assert.ok(listed.body.data.games.every((game) => game.isEnabled));
      }
    });
  });

  await test('2-3 ADMIN disables then enables game', async () => {
    const account = await registerAccount('toggle');
    await promoteExistingUserToAdmin(account.email);
    await withApp(async (baseUrl) => {
      const cookie = await loginCookie(baseUrl, account.email);
      const headers = { cookie, 'content-type': 'application/json' };
      try {
        const disabled = await jsonRequest<AdminGamesData['games'][number]>(
          baseUrl,
          `/api/admin/games/${TIMING_CHALLENGE_GAME_ID}`,
          { method: 'PATCH', headers, body: JSON.stringify({ isEnabled: false }) },
        );
        assert.equal(disabled.status, 200);
        assert.equal(disabled.body.success, true);
        if (disabled.body.success) {
          assert.equal(disabled.body.data.isEnabled, false);
        }
        assert.equal(await isGameEnabled(TIMING_CHALLENGE_GAME_ID), false);

        const enabled = await jsonRequest<AdminGamesData['games'][number]>(
          baseUrl,
          `/api/admin/games/${TIMING_CHALLENGE_GAME_ID}`,
          { method: 'PATCH', headers, body: JSON.stringify({ isEnabled: true }) },
        );
        assert.equal(enabled.body.success, true);
        assert.equal(await isGameEnabled(TIMING_CHALLENGE_GAME_ID), true);
      } finally {
        await cleanupEmail(account.email);
        await resetAvailability();
      }
    });
  });

  await test('4 Guest cannot update', async () => {
    await withApp(async (baseUrl) => {
      const listed = await jsonRequest(baseUrl, `/api/admin/games/${TIMING_CHALLENGE_GAME_ID}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isEnabled: false }),
      });
      assert.notEqual(listed.status, 200);
      assert.equal(listed.body.success, false);
    });
  });

  await test('5 USER cannot update', async () => {
    const account = await registerAccount('user');
    await withApp(async (baseUrl) => {
      const cookie = await loginCookie(baseUrl, account.email);
      try {
        const listed = await jsonRequest(baseUrl, `/api/admin/games/${TIMING_CHALLENGE_GAME_ID}`, {
          method: 'PATCH',
          headers: { cookie, 'content-type': 'application/json' },
          body: JSON.stringify({ isEnabled: false }),
        });
        assert.equal(listed.status, 403);
        assert.equal(listed.body.success, false);
      } finally {
        await cleanupEmail(account.email);
      }
    });
  });

  await test('6 invalid gameId rejected', async () => {
    const account = await registerAccount('invalid');
    await promoteExistingUserToAdmin(account.email);
    await withApp(async (baseUrl) => {
      const cookie = await loginCookie(baseUrl, account.email);
      try {
        const listed = await jsonRequest(baseUrl, '/api/admin/games/not-a-game', {
          method: 'PATCH',
          headers: { cookie, 'content-type': 'application/json' },
          body: JSON.stringify({ isEnabled: false }),
        });
        assert.equal(listed.status, 400);
        assert.equal(listed.body.success, false);
      } finally {
        await cleanupEmail(account.email);
      }
    });
  });

  await test('7 client cannot spoof role', async () => {
    await withApp(async (baseUrl) => {
      const listed = await jsonRequest(baseUrl, `/api/admin/games/${TIMING_CHALLENGE_GAME_ID}?role=ADMIN`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isEnabled: false, role: 'ADMIN' }),
      });
      assert.notEqual(listed.status, 200);
      assert.equal(listed.body.success, false);
      assert.equal(await isGameEnabled(TIMING_CHALLENGE_GAME_ID), true);
    });
  });

  await test('8-10 disabled cannot Start; stale socket rejected; enabled starts', async () => {
    await resetAvailability();
    const room = await twoPlayerRoom();
    try {
      await setGameEnabled(TIMING_CHALLENGE_GAME_ID, false);
      const blocked = await startGameShellFromLobby(
        room.roomId,
        room.hostPlayerId,
        TIMING_CHALLENGE_GAME_ID,
      );
      assert.equal(blocked.success, false);
      if (!blocked.success) {
        assert.equal(blocked.error.code, 'GAME_DISABLED');
        assert.equal(blocked.error.message, GAME_DISABLED_MESSAGE);
      }

      await withSocketServer(async (url) => {
        const socket = await connectClient(url);
        const created = await ack<CreateRoomResponse>(socket, CREATE_ROOM_EVENT, {
          playerName: uniqueName('سوكيت'),
        });
        assert.equal(created.success, true);
        if (!created.success) {
          throw new Error('create failed');
        }
        await joinRoom({ roomCode: created.data.room.code, playerName: uniqueName('ثاني') });
        try {
          const stale = await ack<GameActionResponse<{ state: unknown }>>(
            socket,
            GAME_SHELL_START_FROM_LOBBY_EVENT,
            { gameId: TIMING_CHALLENGE_GAME_ID },
          );
          assert.equal(stale.success, false);
          if (!stale.success) {
            assert.equal(stale.error.code, 'GAME_DISABLED');
          }
          const init = await ack<GameActionResponse<{ state: unknown }>>(
            socket,
            GAME_SHELL_INIT_EVENT,
            { gameId: TIMING_CHALLENGE_GAME_ID },
          );
          assert.equal(init.success, false);
        } finally {
          socket.close();
          await cleanupRoom(created.data.room.id);
        }
      });

      await setGameEnabled(TIMING_CHALLENGE_GAME_ID, true);
      const started = await startGameShellFromLobby(
        room.roomId,
        room.hostPlayerId,
        TIMING_CHALLENGE_GAME_ID,
      );
      assert.equal(started.success, true, started.success ? '' : started.error.message);
    } finally {
      await cleanupRoom(room.roomId);
      await resetAvailability();
    }
  });

  await test('11-13 active continues; completes; lobby cannot restart while disabled', async () => {
    await resetAvailability();
    const room = await twoPlayerRoom();
    try {
      const started = await startGameShellFromLobby(
        room.roomId,
        room.hostPlayerId,
        TIMING_CHALLENGE_GAME_ID,
      );
      assert.equal(started.success, true);
      await setGameEnabled(TIMING_CHALLENGE_GAME_ID, false);
      const shell = getGameShellByRoomId(room.roomId);
      assert.ok(shell);
      assert.equal(shell.gameId, TIMING_CHALLENGE_GAME_ID);

      const matchId = await beginPersistedMatch({
        roomId: room.roomId,
        gameId: TIMING_CHALLENGE_GAME_ID,
        participantPlayerIds: [room.hostPlayerId],
      });
      assert.ok(matchId);
      const completed = await completePersistedMatch(room.roomId);
      assert.equal(completed, true);
      const match = await prisma.match.findUnique({ where: { id: matchId } });
      assert.equal(match?.status, MatchStatus.COMPLETED);

      deleteGameShell(room.roomId);
      const restart = await startGameShellFromLobby(
        room.roomId,
        room.hostPlayerId,
        TIMING_CHALLENGE_GAME_ID,
      );
      assert.equal(restart.success, false);
      if (!restart.success) {
        assert.equal(restart.error.code, 'GAME_DISABLED');
      }
    } finally {
      await cleanupRoom(room.roomId);
      await resetAvailability();
    }
  });

  await test('14 re-enable works without restart', async () => {
    await setGameEnabled(TIMING_CHALLENGE_GAME_ID, false);
    assert.equal(await isGameEnabled(TIMING_CHALLENGE_GAME_ID), false);
    await setGameEnabled(TIMING_CHALLENGE_GAME_ID, true);
    invalidateGameAvailabilityCache();
    assert.equal(await isGameEnabled(TIMING_CHALLENGE_GAME_ID), true);
    await resetAvailability();
  });

  await test('15 settings survive disable/re-enable', async () => {
    const created = await createRoom({ playerName: uniqueName('إعدادات') }, null, 'ADMIN');
    assert.equal(created.success, true);
    if (!created.success) {
      throw new Error(created.error.message);
    }
    const roomId = created.data.room.id;
    try {
      await prisma.room.update({
        where: { id: roomId },
        data: { gameSettings: { 'timing-challenge': { maxSeconds: 120 } } },
      });
      await setGameEnabled(TIMING_CHALLENGE_GAME_ID, false);
      await setGameEnabled(TIMING_CHALLENGE_GAME_ID, true);
      const row = await prisma.room.findUnique({
        where: { id: roomId },
        select: { gameSettings: true },
      });
      const stored = sanitizeRoomGameSettings(row?.gameSettings);
      assert.equal(stored?.['timing-challenge']?.maxSeconds, 120);
    } finally {
      await cleanupRoom(roomId);
      await resetAvailability();
    }
  });

  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
