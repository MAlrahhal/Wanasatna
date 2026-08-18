/**
 * P13-C — live Room administration.
 * Run: pnpm --filter @wanasatna/server test:p13-c
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { io as ioClient, type Socket } from 'socket.io-client';
import { MatchStatus, PlayerStatus } from '@prisma/client';
import {
  ADMIN_ROOM_CLOSED_MESSAGE,
  CREATE_ROOM_EVENT,
  ROOM_CLOSED_EVENT,
  ROOM_UPDATED_EVENT,
  type AdminActionResponse,
  type AdminForceCloseRoomData,
  type AdminKickPlayerData,
  type AdminRoomDetails,
  type AdminRoomLockData,
  type AdminRoomsData,
  type CreateRoomResponse,
  type RoomClosedPayload,
  type RoomUpdatedPayload,
} from '@wanasatna/shared';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { setSocketServer } from '../src/lib/socket-server.js';
import { ADMIN_DENIED_MESSAGE } from '../src/modules/admin/require-admin.js';
import { promoteExistingUserToAdmin } from '../src/modules/admin/promote-existing-user.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { stopExpiredAuthSessionCleanup } from '../src/modules/auth/auth-session-cleanup.js';
import { registerUser } from '../src/modules/auth/auth.service.js';
import { deleteGameShell, getGameShellByRoomId, initGameShell, startGameShellCountdown } from '../src/modules/game/game.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import { leaveRoom } from '../src/modules/room/services/leave-room.service.js';
import { reconnectPlayer } from '../src/modules/room/services/reconnect.service.js';
import { MAX_ROOM_PLAYERS } from '../src/modules/room/room.utils.js';
import { createSocketServer } from '../src/sockets/index.js';
import { stopDisconnectedPlayerExpirySweep } from '../src/modules/room/services/disconnected-player-expiry.service.js';

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
  return `p13c.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
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

function assertNoPrivateLeak(raw: string): void {
  assert.doesNotMatch(raw, /passwordHash|tokenHash|reconnectTokenHash|reconnectToken/i);
  assert.doesNotMatch(raw, /"userId"|"email"|"role"|AuthSession|socketId|socket\.id/i);
  assert.doesNotMatch(raw, /P2025|P2002|PrismaClient|prisma\./);
}

async function withApp<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  resetAuthRateLimiterForTests();
  setSocketServer(null);
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

async function connectClient(url: string): Promise<Socket> {
  const socket = ioClient(url, { autoConnect: true, withCredentials: true });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}

function waitEvent<T>(socket: Socket, event: string, ms = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function main(): Promise<void> {
  resetAuthRateLimiterForTests();

  await test('source: requireAdmin on every room admin route; kick reuses departure; no host impersonation', () => {
    const routes = read('src/modules/admin/admin.routes.ts');
    assert.match(routes, /get\('\/rooms', requireAdmin/);
    assert.match(routes, /get\('\/rooms\/:roomId', requireAdmin/);
    assert.match(routes, /post\('\/rooms\/:roomId\/lock', requireAdmin/);
    assert.match(routes, /post\('\/rooms\/:roomId\/unlock', requireAdmin/);
    assert.match(routes, /post\('\/rooms\/:roomId\/players\/:playerId\/kick', requireAdmin/);
    assert.match(routes, /delete\('\/rooms\/:roomId', requireAdmin/);
    assert.doesNotMatch(routes, /req\.body\.role|player\.userId/);

    const kick = read('src/modules/room/services/leave-room.service.ts');
    const adminKick = kick.slice(kick.indexOf('export async function kickPlayerAsAdmin'));
    assert.match(adminKick, /permanentlyDepartPlayer/);
    assert.match(adminKick, /kind: 'kick'/);
    assert.doesNotMatch(adminKick, /assertHost/);

    const lock = read('src/modules/room/services/shared-room.service.ts');
    const adminLock = lock.slice(lock.indexOf('export async function setRoomLockedAsAdmin'));
    assert.match(adminLock, /isLocked/);
    assert.doesNotMatch(adminLock, /assertHost/);

    const rooms = read('src/modules/admin/admin-rooms.service.ts');
    assert.match(rooms, /setRoomLockedAsAdmin/);
    assert.match(rooms, /kickPlayerAsAdmin/);
    assert.match(rooms, /deleteRoomWithRelations/);
    assert.match(rooms, /permanentlyDepartPlayer|kickPlayerAsAdmin/);
    assert.doesNotMatch(rooms, /lockRoom\(/);
    assert.doesNotMatch(rooms, /abortActiveMatch\(/);
    assert.doesNotMatch(rooms, /passwordHash|reconnectTokenHash|tokenHash/);
    assert.doesNotMatch(rooms, /userId: true|email: true|role: true/);

    const handler = read('src/modules/room/room.socket.handlers.ts');
    assert.match(handler, /announceKickedPlayer/);

    const schema = read('prisma/schema.prisma');
    assert.doesNotMatch(schema, /model AdminAudit|model AdminLog/);
    assert.equal(MAX_ROOM_PLAYERS, 8);
  });

  await test('1 Guest cannot manage Room', async () => {
    await withApp(async (baseUrl) => {
      const list = await jsonRequest<AdminRoomsData>(baseUrl, '/api/admin/rooms');
      assert.equal(list.status, 401);
      assert.equal(!list.body.success && list.body.error.message, ADMIN_DENIED_MESSAGE);
      assertNoPrivateLeak(list.raw);

      const lock = await jsonRequest(baseUrl, '/api/admin/rooms/x/lock', { method: 'POST' });
      assert.equal(lock.status, 401);
      const close = await jsonRequest(baseUrl, '/api/admin/rooms/x', { method: 'DELETE' });
      assert.equal(close.status, 401);
    });
  });

  await test('2 USER cannot manage Room', async () => {
    const { email } = await registerAccount('user');
    await withApp(async (baseUrl) => {
      const cookie = await loginCookie(baseUrl, email);
      const headers = { cookie };
      const list = await jsonRequest<AdminRoomsData>(baseUrl, '/api/admin/rooms', { headers });
      assert.equal(list.status, 403);
      const spoof = await jsonRequest(baseUrl, '/api/admin/rooms?role=ADMIN', {
        headers: { cookie, 'x-user-role': 'ADMIN' },
      });
      assert.equal(spoof.status, 403);
      const kick = await jsonRequest(baseUrl, '/api/admin/rooms/x/players/y/kick', {
        method: 'POST',
        headers,
      });
      assert.equal(kick.status, 403);
    });
    await cleanupEmail(email);
  });

  await test('3 ADMIN can view Room details; 19 no private DTO fields', async () => {
    const { email } = await registerAccount('admin-view');
    await promoteExistingUserToAdmin(email);
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));

    try {
      await withApp(async (baseUrl) => {
        const cookie = await loginCookie(baseUrl, email);
        const headers = { cookie };
        const list = await jsonRequest<AdminRoomsData>(baseUrl, '/api/admin/rooms', { headers });
        assert.equal(list.status, 200);
        assert.equal(list.body.success, true);
        assertNoPrivateLeak(list.raw);
        const listed = list.body.success
          ? list.body.data.rooms.find((room) => room.id === host.room.id)
          : undefined;
        assert.ok(listed);
        assert.equal(listed.code, host.room.code);
        assert.equal(listed.playerCount, 2);
        assert.equal(listed.connectedCount, 2);
        assert.equal(listed.activity, 'LOBBY');
        assert.ok(listed.players.some((player) => player.isHost && player.displayName === host.player.name));
        for (const player of listed.players) {
          assert.deepEqual(Object.keys(player).sort(), [
            'displayName',
            'id',
            'isHost',
            'isSpectator',
            'status',
          ]);
        }

        const detail = await jsonRequest<AdminRoomDetails>(
          baseUrl,
          `/api/admin/rooms/${host.room.id}`,
          { headers },
        );
        assert.equal(detail.status, 200);
        assertNoPrivateLeak(detail.raw);
        assert.equal(detail.body.success && detail.body.data.players.length, 2);
        assert.ok(guest.player.id);
      });
    } finally {
      await cleanupRoom(host.room.id);
      await cleanupEmail(email);
    }
  });

  await test('4-5 Admin lock and unlock persist', async () => {
    const { email } = await registerAccount('admin-lock');
    await promoteExistingUserToAdmin(email);
    const host = await mustCreate(uniqueName('قفل'));

    try {
      await withApp(async (baseUrl) => {
        const cookie = await loginCookie(baseUrl, email);
        const headers = { cookie };
        const locked = await jsonRequest<AdminRoomLockData>(
          baseUrl,
          `/api/admin/rooms/${host.room.id}/lock`,
          { method: 'POST', headers },
        );
        assert.equal(locked.status, 200);
        assert.equal(locked.body.success && locked.body.data.isLocked, true);
        const row = await prisma.room.findUnique({ where: { id: host.room.id } });
        assert.equal(row?.isLocked, true);

        const again = await jsonRequest<AdminRoomLockData>(
          baseUrl,
          `/api/admin/rooms/${host.room.id}/lock`,
          { method: 'POST', headers },
        );
        assert.equal(again.status, 200);

        const unlocked = await jsonRequest<AdminRoomLockData>(
          baseUrl,
          `/api/admin/rooms/${host.room.id}/unlock`,
          { method: 'POST', headers },
        );
        assert.equal(unlocked.status, 200);
        assert.equal(unlocked.body.success && unlocked.body.data.isLocked, false);
        const after = await prisma.room.findUnique({ where: { id: host.room.id } });
        assert.equal(after?.isLocked, false);
      });
    } finally {
      await cleanupRoom(host.room.id);
      await cleanupEmail(email);
    }
  });

  await test('6 Room clients receive lock and close state', async () => {
    const { email } = await registerAccount('admin-sock');
    await promoteExistingUserToAdmin(email);

    await withSocketServer(async (baseUrl) => {
      const cookie = await loginCookie(baseUrl, email);
      const socket = await connectClient(baseUrl);
      try {
        const created = await ack<CreateRoomResponse>(socket, CREATE_ROOM_EVENT, {
          playerName: uniqueName('بث'),
        });
        assert.equal(created.success, true);
        if (!created.success) {
          throw new Error('create failed');
        }
        const roomId = created.data.room.id;

        const updated = waitEvent<RoomUpdatedPayload>(socket, ROOM_UPDATED_EVENT);
        const lock = await jsonRequest<AdminRoomLockData>(
          baseUrl,
          `/api/admin/rooms/${roomId}/lock`,
          { method: 'POST', headers: { cookie } },
        );
        assert.equal(lock.status, 200);
        const payload = await updated;
        assert.equal(payload.roomId, roomId);
        assert.equal(payload.isLocked, true);

        const closed = waitEvent<RoomClosedPayload>(socket, ROOM_CLOSED_EVENT);
        const del = await jsonRequest<AdminForceCloseRoomData>(
          baseUrl,
          `/api/admin/rooms/${roomId}`,
          { method: 'DELETE', headers: { cookie } },
        );
        assert.equal(del.status, 200);
        const closePayload = await closed;
        assert.equal(closePayload.roomId, roomId);
        assert.equal(closePayload.message, ADMIN_ROOM_CLOSED_MESSAGE);
      } finally {
        socket.disconnect();
      }
    });

    await cleanupEmail(email);
  });

  await test('7-8 Admin kick reuses departure and blocks reconnect', async () => {
    const { email } = await registerAccount('admin-kick');
    await promoteExistingUserToAdmin(email);
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    assert.ok(guest.reconnectToken);

    try {
      await withApp(async (baseUrl) => {
        const cookie = await loginCookie(baseUrl, email);
        const kicked = await jsonRequest<AdminKickPlayerData>(
          baseUrl,
          `/api/admin/rooms/${host.room.id}/players/${guest.player.id}/kick`,
          { method: 'POST', headers: { cookie } },
        );
        assert.equal(kicked.status, 200);
        assert.equal(kicked.body.success && kicked.body.data.roomDeleted, false);
        assertNoPrivateLeak(kicked.raw);

        const player = await prisma.player.findUnique({ where: { id: guest.player.id } });
        assert.equal(player?.status, PlayerStatus.LEFT);
        assert.equal(player?.reconnectTokenHash, null);

        const recon = await reconnectPlayer({
          playerId: guest.player.id,
          reconnectToken: guest.reconnectToken,
          roomId: host.room.id,
        });
        assert.equal(recon.success, false);
      });
    } finally {
      await cleanupRoom(host.room.id);
      await cleanupEmail(email);
    }
  });

  await test('9 host kick transfers host safely', async () => {
    const { email } = await registerAccount('admin-hostkick');
    await promoteExistingUserToAdmin(email);
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));

    try {
      await withApp(async (baseUrl) => {
        const cookie = await loginCookie(baseUrl, email);
        const kicked = await jsonRequest<AdminKickPlayerData>(
          baseUrl,
          `/api/admin/rooms/${host.room.id}/players/${host.player.id}/kick`,
          { method: 'POST', headers: { cookie } },
        );
        assert.equal(kicked.status, 200);
        const room = await prisma.room.findUnique({ where: { id: host.room.id } });
        assert.ok(room);
        assert.equal(room.hostPlayerId, guest.player.id);
        const oldHost = await prisma.player.findUnique({ where: { id: host.player.id } });
        assert.equal(oldHost?.status, PlayerStatus.LEFT);
      });
    } finally {
      await cleanupRoom(host.room.id);
      await cleanupEmail(email);
    }
  });

  await test('10 final Player kick cleans Room', async () => {
    const { email } = await registerAccount('admin-last');
    await promoteExistingUserToAdmin(email);
    const host = await mustCreate(uniqueName('أخير'));

    try {
      await withApp(async (baseUrl) => {
        const cookie = await loginCookie(baseUrl, email);
        const kicked = await jsonRequest<AdminKickPlayerData>(
          baseUrl,
          `/api/admin/rooms/${host.room.id}/players/${host.player.id}/kick`,
          { method: 'POST', headers: { cookie } },
        );
        assert.equal(kicked.status, 200);
        assert.equal(kicked.body.success && kicked.body.data.roomDeleted, true);
        const room = await prisma.room.findUnique({ where: { id: host.room.id } });
        assert.equal(room, null);
      });
    } finally {
      await cleanupRoom(host.room.id);
      await cleanupEmail(email);
    }
  });

  await test('11-17 force-close lobby, messages, match, shell, repeat, close reason constant', async () => {
    const { email } = await registerAccount('admin-close');
    await promoteExistingUserToAdmin(email);
    const lobby = await mustCreate(uniqueName('لوبي'));
    const live = await mustCreate(uniqueName('لعبة'));

    try {
      await prisma.roomMessage.create({
        data: {
          roomId: lobby.room.id,
          playerId: lobby.player.id,
          senderNameSnapshot: lobby.player.name,
          content: 'مرحبا',
        },
      });

      const init = await initGameShell(live.room.id, live.player.id, { gameId: 'bara-al-salafa' });
      assert.equal(init.success, true, init.success ? '' : init.error.message);
      const countdown = await startGameShellCountdown(live.room.id, live.player.id);
      assert.equal(countdown.success, true, countdown.success ? '' : countdown.error.message);
      const match = await prisma.match.findFirst({
        where: { roomId: live.room.id, status: MatchStatus.ACTIVE },
      });
      assert.ok(match, 'expected ACTIVE match after countdown');
      assert.ok(getGameShellByRoomId(live.room.id));

      await withApp(async (baseUrl) => {
        const cookie = await loginCookie(baseUrl, email);
        const headers = { cookie };

        const closedLobby = await jsonRequest<AdminForceCloseRoomData>(
          baseUrl,
          `/api/admin/rooms/${lobby.room.id}`,
          { method: 'DELETE', headers },
        );
        assert.equal(closedLobby.status, 200);
        assert.equal(closedLobby.body.success && closedLobby.body.data.alreadyClosed, false);
        assert.equal(await prisma.room.findUnique({ where: { id: lobby.room.id } }), null);
        assert.equal(await prisma.roomMessage.count({ where: { roomId: lobby.room.id } }), 0);

        const closedLive = await jsonRequest<AdminForceCloseRoomData>(
          baseUrl,
          `/api/admin/rooms/${live.room.id}`,
          { method: 'DELETE', headers },
        );
        assert.equal(closedLive.status, 200);
        assert.equal(getGameShellByRoomId(live.room.id), null);
        const surviving = await prisma.match.findUnique({ where: { id: match.id } });
        assert.ok(surviving);
        assert.equal(surviving.status, MatchStatus.ABORTED);
        assert.equal(surviving.roomId, null);

        const repeat = await jsonRequest<AdminForceCloseRoomData>(
          baseUrl,
          `/api/admin/rooms/${live.room.id}`,
          { method: 'DELETE', headers },
        );
        assert.equal(repeat.status, 200);
        assert.equal(repeat.body.success && repeat.body.data.alreadyClosed, true);
        assertNoPrivateLeak(repeat.raw);
        assert.equal(ADMIN_ROOM_CLOSED_MESSAGE, 'تم إغلاق الغرفة من الإدارة.');
      });
    } finally {
      await cleanupRoom(lobby.room.id);
      await cleanupRoom(live.room.id);
      await prisma.match.deleteMany({
        where: { roomCode: { in: [lobby.room.code, live.room.code] } },
      }).catch(() => undefined);
      await cleanupEmail(email);
    }
  });

  await test('18 concurrent Leave and Admin kick stay safe', async () => {
    const { email } = await registerAccount('admin-race');
    await promoteExistingUserToAdmin(email);
    const host = await mustCreate(uniqueName('سباق'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));

    try {
      await withApp(async (baseUrl) => {
        const cookie = await loginCookie(baseUrl, email);
        const [leaveResult, kick] = await Promise.all([
          leaveRoom(guest.player.id, host.room.id),
          jsonRequest<AdminKickPlayerData>(
            baseUrl,
            `/api/admin/rooms/${host.room.id}/players/${guest.player.id}/kick`,
            { method: 'POST', headers: { cookie } },
          ),
        ]);
        assert.equal(leaveResult.success, true);
        assert.ok(kick.status === 200 || kick.status === 404);
        assertNoPrivateLeak(kick.raw);
        const player = await prisma.player.findUnique({ where: { id: guest.player.id } });
        assert.ok(!player || player.status === PlayerStatus.LEFT);
        const room = await prisma.room.findUnique({ where: { id: host.room.id } });
        assert.ok(room);
        assert.equal(room.hostPlayerId, host.player.id);
      });
    } finally {
      await cleanupRoom(host.room.id);
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
