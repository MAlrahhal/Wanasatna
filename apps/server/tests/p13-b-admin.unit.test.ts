/**
 * P13-B — read-only Admin dashboard data.
 * Run: pnpm --filter @wanasatna/server test:p13-b
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MatchStatus, PlayerStatus, RoomStatus } from '@prisma/client';
import {
  ADMIN_DASHBOARD_GAME_IDS,
  ADMIN_DASHBOARD_RECENT_MATCHES_LIMIT,
  ADMIN_DASHBOARD_RECENT_USERS_LIMIT,
  type AdminDashboardData,
} from '@wanasatna/shared';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { ADMIN_DENIED_MESSAGE } from '../src/modules/admin/require-admin.js';
import { promoteExistingUserToAdmin } from '../src/modules/admin/promote-existing-user.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { registerUser } from '../src/modules/auth/auth.service.js';
import { deleteGameShell, initGameShell } from '../src/modules/game/game.service.js';
import {
  abortPersistedMatch,
  beginPersistedMatch,
  completePersistedMatch,
} from '../src/modules/match/match-history.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import { handlePlayerDisconnect } from '../src/modules/room/services/leave-room.service.js';
import { MAX_ROOM_PLAYERS } from '../src/modules/room/room.utils.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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
  return `p13b.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
}

function uniqueName(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 900 + 100)}`;
}

async function cleanupEmail(email: string): Promise<void> {
  await prisma.user.deleteMany({ where: { email } }).catch(() => undefined);
}

async function cleanupRoom(roomId: string): Promise<void> {
  deleteGameShell(roomId);
  await prisma.match.deleteMany({ where: { roomId } }).catch(() => undefined);
  await prisma.room.deleteMany({ where: { id: roomId } }).catch(() => undefined);
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
  return { email, registered };
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

async function getDashboard(baseUrl: string, cookie?: string) {
  const response = await fetch(`${baseUrl}/api/admin/dashboard`, {
    headers: cookie ? { cookie } : undefined,
  });
  const body = (await response.json()) as {
    success?: boolean;
    data?: AdminDashboardData;
    error?: { message?: string };
  };
  return { status: response.status, body, raw: JSON.stringify(body) };
}

async function mustCreate(playerName: string) {
  const result = await createRoom({ playerName });
  assert.equal(result.success, true, result.success ? '' : result.error.message);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

async function mustJoin(roomCode: string, playerName: string) {
  const result = await joinRoom({ roomCode, playerName });
  assert.equal(result.success, true, result.success ? '' : result.error.message);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

async function main(): Promise<void> {
  await test('source: requireAdmin on dashboard; bounded queries; no secrets selected', () => {
    const routes = read('src/modules/admin/admin.routes.ts');
    assert.match(routes, /get\('\/dashboard', requireAdmin/);
    const service = read('src/modules/admin/dashboard.service.ts');
    assert.match(service, /take: ADMIN_DASHBOARD_RECENT_USERS_LIMIT/);
    assert.match(service, /take: ADMIN_DASHBOARD_RECENT_MATCHES_LIMIT/);
    assert.match(service, /groupBy/);
    assert.match(service, /getGameShellByRoomId/);
    assert.doesNotMatch(service, /passwordHash|tokenHash|reconnectTokenHash|authSession/);
    assert.doesNotMatch(service, /RoomStatus\.PLAYING/);
    assert.equal(MAX_ROOM_PLAYERS, 8);
    assert.equal(ADMIN_DASHBOARD_GAME_IDS.length, 8);
  });

  await test('1 Guest dashboard API denied', async () => {
    await withApp(async (baseUrl) => {
      const result = await getDashboard(baseUrl);
      assert.equal(result.status, 401);
      assert.equal(result.body.error?.message, ADMIN_DENIED_MESSAGE);
    });
  });

  await test('2 USER dashboard API denied', async () => {
    const { email } = await registerAccount('user');
    await withApp(async (baseUrl) => {
      const cookie = await loginCookie(baseUrl, email);
      const result = await getDashboard(baseUrl, cookie);
      assert.equal(result.status, 403);
      const spoof = await fetch(`${baseUrl}/api/admin/dashboard?role=ADMIN`, {
        headers: { cookie, 'x-user-role': 'ADMIN' },
      });
      assert.equal(spoof.status, 403);
    });
    await cleanupEmail(email);
  });

  await test('3-6 ADMIN succeeds and never returns secrets', async () => {
    const { email } = await registerAccount('admin');
    await promoteExistingUserToAdmin(email);
    await withApp(async (baseUrl) => {
      const cookie = await loginCookie(baseUrl, email);
      const result = await getDashboard(baseUrl, cookie);
      assert.equal(result.status, 200);
      assert.equal(result.body.success, true);
      assert.ok(result.body.data);
      assert.doesNotMatch(result.raw, /passwordHash|tokenHash|reconnectTokenHash|socketId/i);
      assert.doesNotMatch(result.raw, /canonical|drawing|pluginState|secret/i);
      for (const user of result.body.data.recentUsers) {
        assert.deepEqual(Object.keys(user).sort(), [
          'createdAt',
          'email',
          'id',
          'preferredDisplayName',
          'role',
        ]);
      }
    });
    await cleanupEmail(email);
  });

  await test('7-11 live room counts, spectator, runtime game vs lobby', async () => {
    const { email } = await registerAccount('rooms');
    await promoteExistingUserToAdmin(email);
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    let spectatorRoomId: string | undefined;

    try {
      await handlePlayerDisconnect(guest.player.id, host.room.id);

      const shellRoom = await mustCreate(uniqueName('لعبة'));
      spectatorRoomId = shellRoom.room.id;
      const init = await initGameShell(shellRoom.room.id, shellRoom.player.id, {
        gameId: 'bara-al-salafa',
      });
      assert.equal(init.success, true, init.success ? '' : init.error.message);
      const spectator = await mustJoin(shellRoom.room.code, uniqueName('متفرج'));
      assert.equal(spectator.player.isSpectator, true);

      await withApp(async (baseUrl) => {
        const cookie = await loginCookie(baseUrl, email);
        const result = await getDashboard(baseUrl, cookie);
        assert.equal(result.status, 200);
        const data = result.body.data!;

        const [connectedPlayers, disconnectedPlayers, spectators, currentRooms] = await Promise.all([
          prisma.player.count({
            where: {
              status: PlayerStatus.CONNECTED,
              room: { status: { not: RoomStatus.CLOSED } },
            },
          }),
          prisma.player.count({
            where: {
              status: PlayerStatus.DISCONNECTED,
              room: { status: { not: RoomStatus.CLOSED } },
            },
          }),
          prisma.player.count({
            where: {
              isSpectator: true,
              status: { in: [PlayerStatus.CONNECTED, PlayerStatus.DISCONNECTED] },
              room: { status: { not: RoomStatus.CLOSED } },
            },
          }),
          prisma.room.count({ where: { status: { not: RoomStatus.CLOSED } } }),
        ]);

        assert.equal(data.summary.connectedPlayers, connectedPlayers);
        assert.equal(data.summary.disconnectedPlayers, disconnectedPlayers);
        assert.equal(data.summary.spectators, spectators);
        assert.equal(data.summary.currentRooms, currentRooms);
        assert.equal(data.summary.currentSeats, connectedPlayers + disconnectedPlayers);

        const lobbyRoom = data.liveRooms.find((room) => room.id === host.room.id);
        assert.ok(lobbyRoom);
        assert.equal(lobbyRoom.activity, 'LOBBY');
        assert.equal(lobbyRoom.gameId, null);
        assert.equal(lobbyRoom.connectedCount, 1);
        assert.equal(lobbyRoom.disconnectedCount, 1);
        assert.equal(lobbyRoom.spectatorCount, 0);
        assert.equal(lobbyRoom.playerCount, 2);
        assert.equal('reconnectTokenHash' in lobbyRoom, false);

        const live = data.liveRooms.find((room) => room.id === shellRoom.room.id);
        assert.ok(live);
        assert.equal(live.activity, 'IN_GAME');
        assert.equal(live.gameId, 'bara-al-salafa');
        assert.equal(live.spectatorCount, 1);
        assert.ok(live.gamePhase);
      });
    } finally {
      await cleanupRoom(host.room.id);
      if (spectatorRoomId) {
        await cleanupRoom(spectatorRoomId);
      }
      await cleanupEmail(email);
    }
  });

  await test('12-15 recent lists bounded; match secrets omitted; usage aggregates', async () => {
    const { email } = await registerAccount('history');
    await promoteExistingUserToAdmin(email);
    const completedRoom = await mustCreate(uniqueName('تاريخ'));
    const abortedRoom = await mustCreate(uniqueName('إلغاء'));

    try {
      await beginPersistedMatch({
        roomId: completedRoom.room.id,
        gameId: 'bara-al-salafa',
        participantPlayerIds: [completedRoom.player.id],
      });
      await completePersistedMatch(completedRoom.room.id, [
        { playerId: completedRoom.player.id, isWinner: true, score: 3 },
      ]);
      await beginPersistedMatch({
        roomId: abortedRoom.room.id,
        gameId: 'bara-al-salafa',
        participantPlayerIds: [abortedRoom.player.id],
      });
      await abortPersistedMatch(abortedRoom.room.id);

      await withApp(async (baseUrl) => {
        const cookie = await loginCookie(baseUrl, email);
        const result = await getDashboard(baseUrl, cookie);
        assert.equal(result.status, 200);
        const data = result.body.data!;
        assert.ok(data.recentUsers.length <= ADMIN_DASHBOARD_RECENT_USERS_LIMIT);
        assert.ok(data.recentMatches.length <= ADMIN_DASHBOARD_RECENT_MATCHES_LIMIT);
        assert.doesNotMatch(result.raw, /passwordHash|reconnectToken|canonical|drawing/);

        const [completedMatches, abortedMatches] = await Promise.all([
          prisma.match.count({ where: { status: MatchStatus.COMPLETED } }),
          prisma.match.count({ where: { status: MatchStatus.ABORTED } }),
        ]);
        assert.equal(data.summary.completedMatches, completedMatches);
        assert.equal(data.summary.abortedMatches, abortedMatches);

        const usage = data.gameUsage.find((item) => item.gameId === 'bara-al-salafa');
        assert.ok(usage);
        const [completedCount, abortedCount] = await Promise.all([
          prisma.match.count({
            where: { gameId: 'bara-al-salafa', status: MatchStatus.COMPLETED },
          }),
          prisma.match.count({
            where: { gameId: 'bara-al-salafa', status: MatchStatus.ABORTED },
          }),
        ]);
        assert.equal(usage.completedCount, completedCount);
        assert.equal(usage.abortedCount, abortedCount);
        assert.equal(usage.totalCount, completedCount + abortedCount);
        assert.equal(data.gameUsage.length >= ADMIN_DASHBOARD_GAME_IDS.length, true);

        const recent = data.recentMatches.find((match) => match.roomCode === completedRoom.room.code);
        assert.ok(recent);
        assert.equal(recent.participantCount, 1);
        assert.deepEqual(recent.winnerDisplayNames, [completedRoom.player.name]);
        assert.equal('runtime' in recent, false);
      });
    } finally {
      await cleanupRoom(completedRoom.room.id);
      await cleanupRoom(abortedRoom.room.id);
      await cleanupEmail(email);
    }
  });

  await prisma.$disconnect();
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
