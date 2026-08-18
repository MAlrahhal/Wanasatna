/**
 * P13-D — Admin-created Room capacity 20.
 * Run: pnpm --filter @wanasatna/server test:p13-d
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { io as ioClient, type Socket } from 'socket.io-client';
import { PlayerStatus } from '@prisma/client';
import {
  ADMIN_ROOM_PLAYER_CAP,
  CREATE_ROOM_EVENT,
  MAX_ROOM_PLAYERS,
  type CreateRoomResponse,
  type GameShellPlayer,
} from '@wanasatna/shared';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { setSocketServer } from '../src/lib/socket-server.js';
import { promoteExistingUserToAdmin } from '../src/modules/admin/promote-existing-user.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { stopExpiredAuthSessionCleanup } from '../src/modules/auth/auth-session-cleanup.js';
import {
  logoutAuthSession,
  registerUser,
} from '../src/modules/auth/auth.service.js';
import { registerAllGameContent } from '../src/modules/content/index.js';
import {
  deleteGameShell,
  initGameShell,
} from '../src/modules/game/game.service.js';
import { registerAllGamePlugins } from '../src/modules/game/plugins/index.js';
import { setGuessingChallengeRoomMode } from '../src/modules/game/plugins/guessing-challenge/mode-store.js';
import { validateGameStart } from '../src/modules/game/runtime/validate-game-start.js';
import { MAX_ROOM_PLAYERS as SERVER_MAX_ROOM_PLAYERS } from '../src/modules/room/room.utils.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import { leaveRoom } from '../src/modules/room/services/leave-room.service.js';
import { handlePlayerDisconnect } from '../src/modules/room/services/leave-room.service.js';
import { reconnectPlayer } from '../src/modules/room/services/reconnect.service.js';
import { createSocketServer } from '../src/sockets/index.js';
import { stopDisconnectedPlayerExpirySweep } from '../src/modules/room/services/disconnected-player-expiry.service.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_UP_TO_20 = [
  'bara-al-salafa',
  'draw-guess',
  'imposter-draw',
  'timing-challenge',
  'fast-answer',
  'who-wrote-it',
  'judge',
] as const;

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
  return `p13d.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
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

function connectedPlayers(count: number): GameShellPlayer[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    name: `n${index}`,
    isHost: index === 0,
    isConnected: true,
    isReady: true,
    isSpectator: false,
  }));
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

async function mustCreate(
  playerName: string,
  accountUserId: string | null = null,
  accountRole: 'USER' | 'ADMIN' | null = null,
) {
  const result = await createRoom({ playerName }, accountUserId, accountRole);
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

async function fillSeats(roomCode: string, currentCount: number, targetCount: number): Promise<void> {
  for (let index = currentCount; index < targetCount; index += 1) {
    await mustJoin(roomCode, uniqueName(`ع${index}`));
  }
}

async function loadRoomCap(roomId: string): Promise<number> {
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { playerCap: true } });
  assert.ok(room);
  return room.playerCap;
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

async function main(): Promise<void> {
  resetAuthRateLimiterForTests();

  await test('source: cap is persisted, server-decided, not Host-recalculated', () => {
    const schema = read('prisma/schema.prisma');
    const migration = read('prisma/migrations/20260817170000_add_room_player_cap/migration.sql');
    const create = read('src/modules/room/services/create-room.service.ts');
    const join = read('src/modules/room/services/join-room.service.ts');
    const shared = read('src/modules/room/services/shared-room.service.ts');
    const utils = read('src/modules/room/room.utils.ts');
    const handlers = read('src/modules/room/room.socket.handlers.ts');
    const validators = read('src/modules/room/room.validators.ts');

    assert.match(schema, /playerCap\s+Int\s+@default\(8\)/);
    assert.match(migration, /ADD COLUMN "playerCap" INTEGER NOT NULL DEFAULT 8/);
    assert.doesNotMatch(migration, /DROP |TRUNCATE |DELETE FROM/i);
    assert.equal(MAX_ROOM_PLAYERS, 8);
    assert.equal(ADMIN_ROOM_PLAYER_CAP, 20);
    assert.equal(SERVER_MAX_ROOM_PLAYERS, 8);

    assert.match(create, /accountRole/);
    assert.match(create, /ADMIN_ROOM_PLAYER_CAP/);
    assert.doesNotMatch(create, /prisma\.user\.findUnique/);
    assert.doesNotMatch(create, /validation\.data\.playerCap|payload\.playerCap/);
    assert.match(validators, /createRoomSchema = z\.object\(\{\s*playerName:/);

    assert.match(join, /room\.playerCap/);
    assert.match(shared, /room\.playerCap/);
    assert.match(utils, /playerCap: room\.playerCap/);
    assert.match(handlers, /accountUser\?\.role \?\? null/);
    assert.doesNotMatch(create, /hostPlayer.*role|current Host/);
  });

  await test('1 Guest Create → cap 8', async () => {
    const host = await mustCreate(uniqueName('ضيف'));
    try {
      assert.equal(host.room.playerCap, 8);
      assert.equal(await loadRoomCap(host.room.id), 8);
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('2 USER Create → cap 8', async () => {
    const account = await registerAccount('user');
    try {
      const host = await mustCreate(uniqueName('مستخدم'), account.user.id, 'USER');
      assert.equal(host.room.playerCap, 8);
      await cleanupRoom(host.room.id);
    } finally {
      await cleanupEmail(account.email);
    }
  });

  await test('3 ADMIN Create → cap 20', async () => {
    const account = await registerAccount('admin');
    await promoteExistingUserToAdmin(account.email);
    try {
      const host = await mustCreate(uniqueName('إدارة'), account.user.id, 'ADMIN');
      assert.equal(host.room.playerCap, 20);
      assert.equal(await loadRoomCap(host.room.id), 20);
      await cleanupRoom(host.room.id);
    } finally {
      await cleanupEmail(account.email);
    }
  });

  await test('4-5 client playerCap and role spoof ignored', async () => {
    const spoofed = await createRoom({
      playerName: uniqueName('تزييف'),
      playerCap: 20,
      role: 'ADMIN',
    });
    assert.equal(spoofed.success, true);
    if (!spoofed.success) {
      throw new Error(spoofed.error.message);
    }
    try {
      assert.equal(spoofed.data.room.playerCap, 8);
    } finally {
      await cleanupRoom(spoofed.data.room.id);
    }

    const user = await registerAccount('spoof-user');
    try {
      const asUser = await createRoom(
        { playerName: uniqueName('دور'), playerCap: 20, role: 'ADMIN' },
        user.user.id,
        'USER',
      );
      assert.equal(asUser.success, true);
      if (!asUser.success) {
        throw new Error(asUser.error.message);
      }
      assert.equal(asUser.data.room.playerCap, 8);
      await cleanupRoom(asUser.data.room.id);
    } finally {
      await cleanupEmail(user.email);
    }
  });

  await test('6 expired Admin session → cap 8; userId alone is not ADMIN', async () => {
    const account = await registerAccount('expired');
    await promoteExistingUserToAdmin(account.email);
    try {
      const expired = await mustCreate(uniqueName('منتهي'), account.user.id, null);
      assert.equal(expired.room.playerCap, 8);
      await cleanupRoom(expired.room.id);

      await withSocketServer(async (baseUrl) => {
        await logoutAuthSession(account.sessionToken);
        const socket = await connectClient(
          baseUrl,
          `${AUTH_COOKIE_NAME}=${encodeURIComponent(account.sessionToken)}`,
        );
        const created = await ack<CreateRoomResponse>(socket, CREATE_ROOM_EVENT, {
          playerName: uniqueName('جلسة'),
        });
        socket.disconnect();
        assert.equal(created.success, true);
        if (!created.success) {
          throw new Error(created.error.message);
        }
        assert.equal(created.data.room.playerCap, 8);
        await cleanupRoom(created.data.room.id);
      });
    } finally {
      await cleanupEmail(account.email);
    }
  });

  await test('7 normal Room 9th join rejected', async () => {
    const host = await mustCreate(uniqueName('ثمانية'));
    try {
      await fillSeats(host.room.code, 1, 8);
      const ninth = await joinRoom({ roomCode: host.room.code, playerName: uniqueName('تاسع') });
      assert.equal(ninth.success, false);
      if (ninth.success) {
        throw new Error('expected ROOM_FULL');
      }
      assert.equal(ninth.error.code, 'ROOM_FULL');
      assert.match(ninth.error.message, /الغرفة ممتلئة/);
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('8-9 Admin Room joins 1–20 allowed; 21st rejected', async () => {
    const account = await registerAccount('cap20');
    await promoteExistingUserToAdmin(account.email);
    const host = await mustCreate(uniqueName('عشرون'), account.user.id, 'ADMIN');
    try {
      await fillSeats(host.room.code, 1, 20);
      const twenty = await prisma.player.count({
        where: {
          roomId: host.room.id,
          status: { in: [PlayerStatus.CONNECTED, PlayerStatus.DISCONNECTED] },
        },
      });
      assert.equal(twenty, 20);
      const twentyFirst = await joinRoom({
        roomCode: host.room.code,
        playerName: uniqueName('زيادة'),
      });
      assert.equal(twentyFirst.success, false);
      if (twentyFirst.success) {
        throw new Error('expected ROOM_FULL');
      }
      assert.equal(twentyFirst.error.code, 'ROOM_FULL');
    } finally {
      await cleanupRoom(host.room.id);
      await cleanupEmail(account.email);
    }
  });

  await test('10 spectators count toward cap', async () => {
    const account = await registerAccount('spec');
    await promoteExistingUserToAdmin(account.email);
    const host = await mustCreate(uniqueName('مشاهد'), account.user.id, 'ADMIN');
    try {
      await mustJoin(host.room.code, uniqueName('لاعب'));
      const shell = await initGameShell(host.room.id, host.player.id, { gameId: 'bara-al-salafa' });
      assert.equal(shell.success, true);
      await fillSeats(host.room.code, 2, 20);
      const spectators = await prisma.player.count({
        where: { roomId: host.room.id, isSpectator: true, status: PlayerStatus.CONNECTED },
      });
      assert.equal(spectators, 18);
      const extra = await joinRoom({ roomCode: host.room.code, playerName: uniqueName('خارج') });
      assert.equal(extra.success, false);
      if (!extra.success) {
        assert.equal(extra.error.code, 'ROOM_FULL');
      }
    } finally {
      await cleanupRoom(host.room.id);
      await cleanupEmail(account.email);
    }
  });

  await test('11 LEFT seat does not consume active capacity', async () => {
    const host = await mustCreate(uniqueName('مقعد'));
    try {
      const guest = await mustJoin(host.room.code, uniqueName('غادر'));
      await fillSeats(host.room.code, 2, 8);
      const full = await joinRoom({ roomCode: host.room.code, playerName: uniqueName('ممتلئ') });
      assert.equal(full.success, false);
      await leaveRoom(guest.player.id, host.room.id);
      const left = await prisma.player.findUnique({ where: { id: guest.player.id } });
      assert.equal(left?.status, PlayerStatus.LEFT);
      const replacement = await mustJoin(host.room.code, uniqueName('بديل'));
      assert.equal(replacement.room.playerCap, 8);
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('12-13 Admin leaves and Host transfers to USER → cap remains 20', async () => {
    const account = await registerAccount('leave');
    await promoteExistingUserToAdmin(account.email);
    const user = await registerAccount('newhost');
    const host = await mustCreate(uniqueName('مضيفأ'), account.user.id, 'ADMIN');
    try {
      const guest = await joinRoom(
        { roomCode: host.room.code, playerName: uniqueName('مضيفب') },
        user.user.id,
      );
      assert.equal(guest.success, true);
      if (!guest.success) {
        throw new Error(guest.error.message);
      }
      const left = await leaveRoom(host.player.id, host.room.id);
      assert.equal(left.success, true);
      if (!left.success) {
        throw new Error(left.error.message);
      }
      assert.equal(left.data.roomDeleted, false);
      assert.ok(left.data.hostChanged);
      assert.equal(left.data.hostChanged?.hostPlayerId, guest.data.player.id);
      const room = await prisma.room.findUnique({ where: { id: host.room.id } });
      assert.equal(room?.playerCap, 20);
      assert.equal(room?.hostPlayerId, guest.data.player.id);
    } finally {
      await cleanupRoom(host.room.id);
      await cleanupEmail(account.email);
      await cleanupEmail(user.email);
    }
  });

  await test('14 Admin logs out → existing Room remains 20', async () => {
    const account = await registerAccount('logout');
    await promoteExistingUserToAdmin(account.email);
    const host = await mustCreate(uniqueName('خروج'), account.user.id, 'ADMIN');
    try {
      await logoutAuthSession(account.sessionToken);
      assert.equal(await loadRoomCap(host.room.id), 20);
    } finally {
      await cleanupRoom(host.room.id);
      await cleanupEmail(account.email);
    }
  });

  await test('15 Room reconnect unchanged and keeps playerCap', async () => {
    const account = await registerAccount('reconn');
    await promoteExistingUserToAdmin(account.email);
    const host = await mustCreate(uniqueName('عودة'), account.user.id, 'ADMIN');
    try {
      assert.ok(host.reconnectToken);
      await handlePlayerDisconnect(host.player.id, host.room.id);
      const resumed = await reconnectPlayer({
        playerId: host.player.id,
        reconnectToken: host.reconnectToken,
        roomCode: host.room.code,
      });
      assert.equal(resumed.success, true);
      if (!resumed.success) {
        throw new Error(resumed.error.message);
      }
      assert.equal(resumed.data.room.playerCap, 20);
      assert.equal(resumed.data.player.id, host.player.id);
    } finally {
      await cleanupRoom(host.room.id);
      await cleanupEmail(account.email);
    }
  });

  await test('16 Room snapshot exposes playerCap only, not Admin role', async () => {
    const account = await registerAccount('snap');
    await promoteExistingUserToAdmin(account.email);
    const host = await mustCreate(uniqueName('لقطة'), account.user.id, 'ADMIN');
    try {
      const roomKeys = Object.keys(host.room).sort();
      assert.deepEqual(roomKeys, [
        'code',
        'createdAt',
        'gameSettings',
        'hostPlayerId',
        'id',
        'isLocked',
        'playerCap',
        'status',
      ]);
      assert.equal('role' in host.room, false);
      assert.equal('userId' in host.player, false);
      assert.equal('email' in host.player, false);
      const raw = JSON.stringify(host);
      assert.doesNotMatch(raw, /"role"|passwordHash|tokenHash|reconnectTokenHash/);
      assert.doesNotMatch(raw, /"userId"/);
    } finally {
      await cleanupRoom(host.room.id);
      await cleanupEmail(account.email);
    }
  });

  await test('17-23 seven games accept 9–20; 24 Guessing Challenge stays 2/4', () => {
    for (const gameId of GAMES_UP_TO_20) {
      assert.equal(validateGameStart(gameId, `${gameId}-9`, 'p0', connectedPlayers(9)), null);
      assert.equal(validateGameStart(gameId, `${gameId}-20`, 'p0', connectedPlayers(20)), null);
      assert.ok(validateGameStart(gameId, `${gameId}-21`, 'p0', connectedPlayers(21)));
    }

    assert.equal(
      validateGameStart('guessing-challenge', 'gc-2', 'p0', connectedPlayers(2)),
      null,
    );
    setGuessingChallengeRoomMode('gc-4', '2v2');
    assert.equal(
      validateGameStart('guessing-challenge', 'gc-4', 'p0', connectedPlayers(4)),
      null,
    );
    assert.ok(validateGameStart('guessing-challenge', 'gc-3', 'p0', connectedPlayers(3)));
    assert.ok(validateGameStart('guessing-challenge', 'gc-8', 'p0', connectedPlayers(8)));
    assert.ok(validateGameStart('guessing-challenge', 'gc-20', 'p0', connectedPlayers(20)));

    const gcSettings = read('../../content/guessing-challenge/settings.json');
    assert.match(gcSettings, /"maxPlayers": 4/);
    for (const gameId of [
      'bara-al-salafa',
      'draw-guess',
      'imposter-draw',
      'fast-answer',
      'who-wrote-it',
      'judge',
    ]) {
      assert.match(read(`../../content/${gameId}/settings.json`), /"maxPlayers": 20/);
    }
    assert.match(read('src/modules/game/plugins/timing-challenge/plugin.ts'), /maxPlayers: 20/);
  });

  await test('P13-C admin DTO includes playerCap and omits role/userId', () => {
    const rooms = read('src/modules/admin/admin-rooms.service.ts');
    const dashboard = read('src/modules/admin/dashboard.service.ts');
    const mapper = rooms.slice(rooms.indexOf('function mapRoomDetails'));
    assert.match(rooms, /playerCap: true/);
    assert.match(rooms, /playerCap: row\.playerCap/);
    assert.match(dashboard, /playerCap: room\.playerCap/);
    assert.doesNotMatch(mapper, /userId: true|email: true|role: true/);
    assert.doesNotMatch(mapper, /userId: player|role: /);
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
