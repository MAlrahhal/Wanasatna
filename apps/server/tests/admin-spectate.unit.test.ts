/**
 * Admin Spectate — isolated read-only live room observer.
 * Run: pnpm --filter @wanasatna/server test:admin-spectate
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { io as ioClient, type Socket } from 'socket.io-client';
import { PlayerStatus, RoomStatus } from '@prisma/client';
import {
  ADMIN_SPECTATE_JOIN_EVENT,
  ADMIN_SPECTATE_SYNC_EVENT,
  CREATE_ROOM_EVENT,
  GAME_SHELL_SET_READY_EVENT,
  JOIN_ROOM_EVENT,
  ROOM_CHAT_SEND_EVENT,
  ROOM_CLOSED_EVENT,
  type AdminActionResponse,
  type AdminSpectateData,
  type CreateRoomResponse,
  type RoomActionResponse,
  type RoomClosedPayload,
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
import { deleteGameShell, initGameShell } from '../src/modules/game/game.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
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
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  }
}

function uniqueEmail(prefix: string): string {
  return `spectate.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
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

function ack<T>(socket: Socket, event: string, payload: unknown = {}): Promise<T> {
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

function waitEvent<T>(socket: Socket, event: string, ms = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
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

async function seatCount(roomId: string): Promise<number> {
  return prisma.player.count({
    where: { roomId, status: { in: [PlayerStatus.CONNECTED, PlayerStatus.DISCONNECTED] } },
  });
}

async function main(): Promise<void> {
  resetAuthRateLimiterForTests();

  await test('source: isolated admin spectate path does not reuse public join', () => {
    const sockets = read('src/sockets/index.ts');
    assert.match(sockets, /registerAdminSpectateSockets/);
    assert.doesNotMatch(read('src/index.ts'), /adminSpectate|admin-spectate/);

    const spectate = read('src/modules/admin/admin-spectate.socket.ts');
    assert.match(spectate, /attachAdminSpectateEmitGuard/);
    assert.match(spectate, /ADMIN_SPECTATE_ALLOWED_EVENTS/);
    assert.match(spectate, /socket\.data\.playerId = undefined/);
    assert.match(spectate, /resolveSocketAccountUser/);
    assert.match(spectate, /authorizeAdmin/);
    assert.doesNotMatch(spectate, /joinRoom\(/);
    assert.doesNotMatch(spectate, /bindSocketToRoomSession/);

    const join = read('src/modules/room/services/join-room.service.ts');
    assert.doesNotMatch(join, /adminSpectate|ROOM_SPECTATE|admin-spectate/);

    const schema = read('prisma/schema.prisma');
    assert.doesNotMatch(schema, /AdminSpectate|adminSpectate/);
  });

  await test('guest and USER cannot spectate; admin can without a Player seat', async () => {
    const { email: userEmail } = await registerAccount('user');
    const { email: adminEmail } = await registerAccount('admin');
    await promoteExistingUserToAdmin(adminEmail);
    const host = await mustCreate(uniqueName('مضيف'));
    await mustJoin(host.room.code, uniqueName('ضيف'));

    try {
      await withSocketServer(async (baseUrl) => {
        const guestSocket = await connectClient(baseUrl);
        const guest = await ack<AdminActionResponse<AdminSpectateData>>(
          guestSocket,
          ADMIN_SPECTATE_JOIN_EVENT,
          { roomId: host.room.id },
        );
        assert.equal(guest.success, false);
        assert.equal(guest.success || guest.error.code, 'UNAUTHORIZED');
        guestSocket.disconnect();

        const userCookie = await loginCookie(baseUrl, userEmail);
        const userSocket = await connectClient(baseUrl, userCookie);
        const user = await ack<AdminActionResponse<AdminSpectateData>>(
          userSocket,
          ADMIN_SPECTATE_JOIN_EVENT,
          { roomId: host.room.id },
        );
        assert.equal(user.success, false);
        assert.equal(user.success || user.error.code, 'FORBIDDEN');
        userSocket.disconnect();

        const before = await seatCount(host.room.id);
        const adminCookie = await loginCookie(baseUrl, adminEmail);
        const adminSocket = await connectClient(baseUrl, adminCookie);
        const spectate = await ack<AdminActionResponse<AdminSpectateData>>(
          adminSocket,
          ADMIN_SPECTATE_JOIN_EVENT,
          { roomId: host.room.id },
        );
        assert.equal(spectate.success, true, spectate.success ? '' : spectate.error.message);
        if (!spectate.success) {
          throw new Error('spectate failed');
        }
        assert.equal(spectate.data.room.id, host.room.id);
        assert.equal(
          spectate.data.room.players.some((player) => player.id.includes('admin_spectate')),
          false,
        );
        assert.equal(await seatCount(host.room.id), before);
        assert.equal(spectate.data.room.playerCount, before);

        const ready = await ack<AdminActionResponse<never>>(
          adminSocket,
          GAME_SHELL_SET_READY_EVENT,
          { isReady: true },
        );
        assert.equal(ready.success, false);
        assert.equal(ready.success || ready.error.code, 'FORBIDDEN');

        const chat = await ack<RoomActionResponse<never>>(adminSocket, ROOM_CHAT_SEND_EVENT, {
          message: 'hello',
        });
        assert.equal(chat.success, false);

        const joinAttempt = await ack<RoomActionResponse<CreateRoomResponse>>(
          adminSocket,
          JOIN_ROOM_EVENT,
          { roomCode: host.room.code, playerName: uniqueName('تسلل') },
        );
        assert.equal(joinAttempt.success, false);
        assert.equal(await seatCount(host.room.id), before);

        adminSocket.disconnect();
      });
    } finally {
      await cleanupRoom(host.room.id);
      await cleanupEmail(userEmail);
      await cleanupEmail(adminEmail);
    }
  });

  await test('closed rooms cannot be spectated; close while watching is signaled', async () => {
    const { email } = await registerAccount('close');
    await promoteExistingUserToAdmin(email);
    const live = await mustCreate(uniqueName('مباشر'));
    const closed = await mustCreate(uniqueName('مغلق'));

    try {
      await prisma.room.update({
        where: { id: closed.room.id },
        data: { status: RoomStatus.CLOSED },
      });

      await withSocketServer(async (baseUrl) => {
        const cookie = await loginCookie(baseUrl, email);
        const socket = await connectClient(baseUrl, cookie);

        const denied = await ack<AdminActionResponse<AdminSpectateData>>(
          socket,
          ADMIN_SPECTATE_JOIN_EVENT,
          { roomId: closed.room.id },
        );
        assert.equal(denied.success, false);
        assert.equal(denied.success || denied.error.code, 'ROOM_CLOSED');

        const joined = await ack<AdminActionResponse<AdminSpectateData>>(
          socket,
          ADMIN_SPECTATE_JOIN_EVENT,
          { roomId: live.room.id },
        );
        assert.equal(joined.success, true);
        const closedEvent = waitEvent<RoomClosedPayload>(socket, ROOM_CLOSED_EVENT);
        const closeRes = await fetch(`${baseUrl}/api/admin/rooms/${live.room.id}`, {
          method: 'DELETE',
          headers: { cookie },
        });
        assert.equal(closeRes.status, 200);
        await closedEvent;

        const sync = await ack<AdminActionResponse<AdminSpectateData>>(
          socket,
          ADMIN_SPECTATE_SYNC_EVENT,
        );
        assert.equal(sync.success, false);
        socket.disconnect();
      });
    } finally {
      await cleanupRoom(live.room.id);
      await cleanupRoom(closed.room.id);
      await cleanupEmail(email);
    }
  });

  await test('normal spectator join and player seats stay intact during admin spectate', async () => {
    const { email } = await registerAccount('mix');
    await promoteExistingUserToAdmin(email);
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));

    try {
      const init = await initGameShell(host.room.id, host.player.id, { gameId: 'bara-al-salafa' });
      assert.equal(init.success, true, init.success ? '' : init.error.message);

      await withSocketServer(async (baseUrl) => {
        const cookie = await loginCookie(baseUrl, email);
        const adminSocket = await connectClient(baseUrl, cookie);
        const spectate = await ack<AdminActionResponse<AdminSpectateData>>(
          adminSocket,
          ADMIN_SPECTATE_JOIN_EVENT,
          { roomId: host.room.id },
        );
        assert.equal(spectate.success, true);

        const before = await seatCount(host.room.id);
        const spectator = await mustJoin(host.room.code, uniqueName('متفرج'));
        assert.equal(spectator.player.isSpectator, true);
        assert.equal(await seatCount(host.room.id), before + 1);
        assert.notEqual(spectator.player.id, '');
        assert.equal(guest.player.isSpectator, false);
        assert.equal(host.player.isSpectator, false);

        const playerSocket = await connectClient(baseUrl);
        const created = await ack<CreateRoomResponse>(playerSocket, CREATE_ROOM_EVENT, {
          playerName: uniqueName('غرفة'),
        });
        assert.equal(created.success, true);

        adminSocket.disconnect();
        playerSocket.disconnect();
        await cleanupRoom(created.success ? created.data.room.id : 'missing');
      });
    } finally {
      await cleanupRoom(host.room.id);
      await cleanupEmail(email);
    }
  });

  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
