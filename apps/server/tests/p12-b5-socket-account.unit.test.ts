/**
 * P12-B.5 — optional Socket.IO account identity + Player.userId.
 * Run: pnpm --filter @wanasatna/server test:p12-b5
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { io as ioClient, type Socket } from 'socket.io-client';
import { PlayerStatus } from '@prisma/client';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { registerUser } from '../src/modules/auth/auth.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import { handlePlayerDisconnect, leaveRoom } from '../src/modules/room/services/leave-room.service.js';
import { reconnectPlayer } from '../src/modules/room/services/reconnect.service.js';
import { createSocketServer } from '../src/sockets/index.js';
import { stopDisconnectedPlayerExpirySweep } from '../src/modules/room/services/disconnected-player-expiry.service.js';
import { stopExpiredAuthSessionCleanup } from '../src/modules/auth/auth-session-cleanup.js';
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

function uniqueName(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 900 + 100)}`;
}

function uniqueEmail(prefix: string): string {
  return `p12b5.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
}

async function cleanupEmail(email: string): Promise<void> {
  await prisma.user.deleteMany({ where: { email } }).catch(() => undefined);
}

async function mustCreate(playerName: string, accountUserId: string | null = null) {
  const result = await createRoom({ playerName }, accountUserId);
  assert.equal(result.success, true, result.success ? '' : result.error.message);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

async function loadPlayer(playerId: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  assert.ok(player, `missing player ${playerId}`);
  return player;
}

async function registerAccount(prefix: string) {
  const email = uniqueEmail(prefix);
  const registered = await registerUser({
    email,
    password: 'password-ok',
    preferredDisplayName: uniqueName('اسم'),
  });
  assert.equal(registered.success, true);
  assert.ok(registered.session);
  return { email, user: registered.data.user, sessionToken: registered.session.sessionToken };
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

async function withSocketServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
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
    io.close();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function main(): Promise<void> {
  await test('source: Player.userId is optional with SetNull + index', () => {
    const schema = read('prisma/schema.prisma');
    assert.match(schema, /userId\s+String\?/);
    assert.match(schema, /onDelete: SetNull/);
    assert.match(schema, /@@index\(\[userId\]\)/);
    assert.match(read('prisma/migrations/20260816200000_add_player_userid/migration.sql'), /ADD COLUMN "userId"/);
    assert.equal(MAX_ROOM_PLAYERS, 8);
  });

  await test('source: sockets resolve cookie auth; reconnect does not relink; create/join omit client userId', () => {
    assert.match(read('src/sockets/index.ts'), /attachOptionalSocketAuth/);
    assert.match(read('src/sockets/index.ts'), /credentials: true/);
    assert.match(read('src/modules/auth/socket-auth.ts'), /resolveAuthSession/);
    assert.doesNotMatch(read('src/modules/auth/socket-auth.ts'), /next\(new Error/);
    assert.match(read('src/modules/room/room.socket.handlers.ts'), /resolveSocketAccountUser/);
    assert.doesNotMatch(read('src/modules/room/services/reconnect.service.ts'), /modules\/auth/);
    assert.doesNotMatch(read('src/modules/room/services/reconnect.service.ts'), /userId:/);
    assert.match(read('src/modules/room/room.validators.ts'), /playerName: playerNameSchema/);
    assert.doesNotMatch(read('src/modules/room/room.validators.ts'), /userId/);
    assert.doesNotMatch(read('src/modules/room/room.utils.ts'), /userId:/);
  });

  await test('guest create/join leave Player.userId null', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const joined = await joinRoom({ roomCode: host.room.code, playerName: uniqueName('ضيف') });
    assert.equal(joined.success, true);
    if (!joined.success) {
      throw new Error(joined.error.message);
    }
    const hostRow = await loadPlayer(host.player.id);
    const guestRow = await loadPlayer(joined.data.player.id);
    assert.equal(hostRow.userId, null);
    assert.equal(guestRow.userId, null);
    await leaveRoom(joined.data.player.id, joined.data.room.id);
    await leaveRoom(host.player.id, host.room.id);
  });

  await test('authenticated create/join sets Player.userId from account, not payload', async () => {
    const account = await registerAccount('link');
    const other = await registerAccount('other');
    try {
      const created = await createRoom(
        { playerName: uniqueName('مضيف'), userId: other.user.id },
        account.user.id,
      );
      assert.equal(created.success, true);
      if (!created.success) {
        throw new Error(created.error.message);
      }
      const hostRow = await loadPlayer(created.data.player.id);
      assert.equal(hostRow.userId, account.user.id);

      const spoofed = await createRoom({ playerName: uniqueName('ضيف'), userId: account.user.id });
      assert.equal(spoofed.success, true);
      if (!spoofed.success) {
        throw new Error(spoofed.error.message);
      }
      const spoofRow = await loadPlayer(spoofed.data.player.id);
      assert.equal(spoofRow.userId, null);

      const joined = await joinRoom(
        { roomCode: created.data.room.code, playerName: uniqueName('لاعب'), userId: other.user.id },
        account.user.id,
      );
      assert.equal(joined.success, true);
      if (!joined.success) {
        throw new Error(joined.error.message);
      }
      const joinRow = await loadPlayer(joined.data.player.id);
      assert.equal(joinRow.userId, account.user.id);

      await leaveRoom(joined.data.player.id, joined.data.room.id);
      await leaveRoom(created.data.player.id, created.data.room.id);
      await leaveRoom(spoofed.data.player.id, spoofed.data.room.id);
    } finally {
      await cleanupEmail(account.email);
      await cleanupEmail(other.email);
    }
  });

  await test('reconnect keeps original Player.userId and still uses playerId+token', async () => {
    const account = await registerAccount('seat');
    const later = await registerAccount('later');
    try {
      const created = await mustCreate(uniqueName('مقعد'), account.user.id);
      assert.ok(created.reconnectToken);
      await handlePlayerDisconnect(created.player.id, created.room.id);
      const before = await loadPlayer(created.player.id);
      assert.equal(before.userId, account.user.id);

      const resumed = await reconnectPlayer({
        playerId: created.player.id,
        reconnectToken: created.reconnectToken,
        roomCode: created.room.code,
      });
      assert.equal(resumed.success, true);
      if (!resumed.success) {
        throw new Error(resumed.error.message);
      }
      const after = await loadPlayer(created.player.id);
      assert.equal(after.userId, account.user.id);
      assert.notEqual(after.userId, later.user.id);
      assert.equal(after.status, PlayerStatus.CONNECTED);

      await leaveRoom(created.player.id, created.room.id);
    } finally {
      await cleanupEmail(account.email);
      await cleanupEmail(later.email);
    }
  });

  await test('authentication does not reclaim an existing Player seat', async () => {
    const account = await registerAccount('reclaim');
    try {
      const first = await mustCreate(uniqueName('أول'), account.user.id);
      await handlePlayerDisconnect(first.player.id, first.room.id);
      const second = await joinRoom(
        { roomCode: first.room.code, playerName: uniqueName('ثان') },
        account.user.id,
      );
      assert.equal(second.success, true);
      if (!second.success) {
        throw new Error(second.error.message);
      }
      assert.notEqual(second.data.player.id, first.player.id);
      const firstRow = await loadPlayer(first.player.id);
      const secondRow = await loadPlayer(second.data.player.id);
      assert.equal(firstRow.status, PlayerStatus.DISCONNECTED);
      assert.equal(firstRow.userId, account.user.id);
      assert.equal(secondRow.userId, account.user.id);

      await leaveRoom(second.data.player.id, second.data.room.id);
      await leaveRoom(first.player.id, first.room.id);
    } finally {
      await cleanupEmail(account.email);
    }
  });

  await test('socket handshake cookie links Create; missing/invalid cookie stays Guest', async () => {
    const account = await registerAccount('sock');
    try {
      await withSocketServer(async (baseUrl) => {
        const guest = await connectClient(baseUrl);
        const guestCreate = await ack<{
          success: boolean;
          data?: { room: { id: string }; player: { id: string } };
          error?: { message: string };
        }>(guest, 'create-room', { playerName: uniqueName('ضيف') });
        assert.equal(guestCreate.success, true, guestCreate.error?.message);
        const guestRow = await loadPlayer(guestCreate.data!.player.id);
        assert.equal(guestRow.userId, null);
        guest.disconnect();
        await leaveRoom(guestCreate.data!.player.id, guestCreate.data!.room.id);

        const invalid = await connectClient(baseUrl, `${AUTH_COOKIE_NAME}=not-a-real-session`);
        const invalidCreate = await ack<{
          success: boolean;
          data?: { room: { id: string }; player: { id: string } };
          error?: { message: string };
        }>(invalid, 'create-room', { playerName: uniqueName('باطل') });
        assert.equal(invalidCreate.success, true, invalidCreate.error?.message);
        const invalidRow = await loadPlayer(invalidCreate.data!.player.id);
        assert.equal(invalidRow.userId, null);
        invalid.disconnect();
        await leaveRoom(invalidCreate.data!.player.id, invalidCreate.data!.room.id);

        const hostSock = await connectClient(
          baseUrl,
          `${AUTH_COOKIE_NAME}=${encodeURIComponent(account.sessionToken)}`,
        );
        const authedCreate = await ack<{
          success: boolean;
          data?: { room: { id: string; code: string }; player: { id: string } };
          error?: { message: string };
        }>(hostSock, 'create-room', { playerName: uniqueName('حساب') });
        assert.equal(authedCreate.success, true, authedCreate.error?.message);
        const authedRow = await loadPlayer(authedCreate.data!.player.id);
        assert.equal(authedRow.userId, account.user.id);

        const joinerSock = await connectClient(
          baseUrl,
          `${AUTH_COOKIE_NAME}=${encodeURIComponent(account.sessionToken)}`,
        );
        const authedJoin = await ack<{
          success: boolean;
          data?: { room: { id: string }; player: { id: string } };
          error?: { message: string };
        }>(joinerSock, 'join-room', {
          roomCode: authedCreate.data!.room.code,
          playerName: uniqueName('انضمام'),
        });
        assert.equal(authedJoin.success, true, authedJoin.error?.message);
        const joinRow = await loadPlayer(authedJoin.data!.player.id);
        assert.equal(joinRow.userId, account.user.id);

        joinerSock.disconnect();
        hostSock.disconnect();
        await leaveRoom(authedJoin.data!.player.id, authedJoin.data!.room.id);
        await leaveRoom(authedCreate.data!.player.id, authedCreate.data!.room.id);
      });
    } finally {
      await cleanupEmail(account.email);
    }
  });

  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main().finally(async () => {
  await prisma.$disconnect();
});
