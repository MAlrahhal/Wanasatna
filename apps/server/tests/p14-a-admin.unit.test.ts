/**
 * P14-A — operational observability (health + admin system).
 * Run: pnpm --filter @wanasatna/server test:p14-a
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { io as ioClient } from 'socket.io-client';
import { MatchStatus } from '@prisma/client';
import type { AdminActionResponse, AdminSystemData } from '@wanasatna/shared';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { opsLogger } from '../src/lib/ops-logger.js';
import { prisma } from '../src/lib/prisma.js';
import { setDatabaseProbeForTests } from '../src/lib/public-health.js';
import { setSocketServer } from '../src/lib/socket-server.js';
import { ADMIN_DENIED_MESSAGE } from '../src/modules/admin/require-admin.js';
import { promoteExistingUserToAdmin } from '../src/modules/admin/promote-existing-user.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { stopExpiredAuthSessionCleanup } from '../src/modules/auth/auth-session-cleanup.js';
import { registerUser } from '../src/modules/auth/auth.service.js';
import { registerAllGameContent } from '../src/modules/content/index.js';
import { deleteGameShell, replaceGameShellForTests } from '../src/modules/game/game.service.js';
import { registerAllGamePlugins } from '../src/modules/game/plugins/index.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { stopDisconnectedPlayerExpirySweep } from '../src/modules/room/services/disconnected-player-expiry.service.js';
import { createSocketServer } from '../src/sockets/index.js';

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
  return `p14a.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
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

function assertNoSecrets(raw: string): void {
  assert.doesNotMatch(raw, /passwordHash|tokenHash|reconnectTokenHash|reconnectToken/i);
  assert.doesNotMatch(raw, /DATABASE_URL|postgres(ql)?:\/\//i);
  assert.doesNotMatch(raw, /neon\.tech|ep-crimson/i);
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
  return { email, user: registered.session.user };
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

async function main(): Promise<void> {
  await test('source: requireAdmin system; health probe; no analytics model', () => {
    const routes = read('src/modules/admin/admin.routes.ts');
    const health = read('src/lib/public-health.ts');
    const logger = read('src/lib/ops-logger.ts');
    const index = read('src/index.ts');
    assert.match(routes, /get\('\/system', requireAdmin/);
    assert.match(health, /\$queryRaw/);
    assert.match(logger, /FORBIDDEN_META_KEY/);
    assert.match(index, /uncaughtException/);
    assert.match(index, /unhandledRejection/);
    assert.doesNotMatch(read('prisma/schema.prisma'), /AnalyticsEvent/);
    assert.doesNotMatch(logger, /passwordHash|reconnectToken/);
  });

  await test('1-3 /health healthy 200; DB failure 503; no internals', async () => {
    await withApp(async (baseUrl) => {
      const ok = await fetch(`${baseUrl}/health`);
      const apiOk = await fetch(`${baseUrl}/api/health`);
      assert.equal(ok.status, 200);
      assert.equal(apiOk.status, 200);
      const body = (await ok.json()) as { status: string };
      assert.equal(body.status, 'ok');
      assert.deepEqual(await apiOk.json(), { status: 'ok' });
      const raw = JSON.stringify(body);
      assertNoSecrets(raw);
      assert.doesNotMatch(raw, /stack|Prisma|rooms|sockets/i);
    });

    setDatabaseProbeForTests(async () => {
      throw new Error('db down');
    });
    try {
      await withApp(async (baseUrl) => {
        const failed = await fetch(`${baseUrl}/health`);
        assert.equal(failed.status, 503);
        const raw = await failed.text();
        const body = JSON.parse(raw) as { status: string };
        assert.equal(body.status, 'unavailable');
        assertNoSecrets(raw);
        assert.doesNotMatch(raw, /db down|Prisma|DATABASE/i);
      });
    } finally {
      setDatabaseProbeForTests(null);
    }
  });

  await test('4-6 Guest/USER denied; ADMIN allowed', async () => {
    const { email: userEmail } = await registerAccount('user');
    const { email: adminEmail } = await registerAccount('admin');
    await promoteExistingUserToAdmin(adminEmail);
    try {
      await withApp(async (baseUrl) => {
        const guest = await jsonRequest(baseUrl, '/api/admin/system');
        assert.equal(guest.status, 401);
        assert.equal(guest.body.success, false);
        if (!guest.body.success) {
          assert.equal(guest.body.error.message, ADMIN_DENIED_MESSAGE);
        }

        const userCookie = await loginCookie(baseUrl, userEmail);
        const user = await jsonRequest(baseUrl, '/api/admin/system', {
          headers: { cookie: userCookie },
        });
        assert.equal(user.status, 403);

        const adminCookie = await loginCookie(baseUrl, adminEmail);
        const admin = await jsonRequest<AdminSystemData>(baseUrl, '/api/admin/system', {
          headers: { cookie: adminCookie },
        });
        assert.equal(admin.status, 200);
        assert.equal(admin.body.success, true);
      });
    } finally {
      await cleanupEmail(userEmail);
      await cleanupEmail(adminEmail);
    }
  });

  await test('7-14 ADMIN system snapshot is bounded and secret-free', async () => {
    const { email } = await registerAccount('sys');
    await promoteExistingUserToAdmin(email);
    const created = await createRoom({ playerName: uniqueName('مضيف') });
    assert.equal(created.success, true);
    if (!created.success) {
      throw new Error('create failed');
    }
    const match = await prisma.match.create({
      data: {
        roomId: created.data.room.id,
        roomCode: created.data.room.code,
        gameId: 'bara-al-salafa',
        status: MatchStatus.ACTIVE,
      },
    });
    replaceGameShellForTests({
      shellId: 'p14a-shell',
      roomId: created.data.room.id,
      gameId: 'bara-al-salafa',
      phase: 'WAITING',
      hostPlayerId: created.data.player.id,
      players: [
        {
          id: created.data.player.id,
          name: created.data.player.name,
          isHost: true,
          isConnected: true,
          isReady: false,
        },
      ],
      readyPlayerIds: [],
      countdownSeconds: 3,
      countdownRemainingSeconds: null,
      gameTimerSeconds: 60,
      gameTimerRemainingSeconds: null,
      startedAt: null,
      finishedAt: null,
      updatedAt: new Date().toISOString(),
      matchParticipantIds: null,
    });

    try {
      await withSocketServer(async (baseUrl) => {
        const cookie = await loginCookie(baseUrl, email);
        const socketA = ioClient(baseUrl, { transports: ['websocket'] });
        const socketB = ioClient(baseUrl, { transports: ['websocket'] });
        await Promise.all([
          new Promise<void>((resolve) => socketA.on('connect', () => resolve())),
          new Promise<void>((resolve) => socketB.on('connect', () => resolve())),
        ]);

        const result = await jsonRequest<AdminSystemData>(baseUrl, '/api/admin/system', {
          headers: { cookie },
        });
        assert.equal(result.status, 200);
        assert.equal(result.body.success, true);
        if (!result.body.success) {
          throw new Error('system failed');
        }
        const data = result.body.data;
        assert.ok(data.uptimeSeconds >= 0);
        assert.ok(data.connectedSockets >= 2);
        const expectedRooms = await prisma.room.count({
          where: { status: { not: 'CLOSED' } },
        });
        const expectedActive = await prisma.match.count({ where: { status: MatchStatus.ACTIVE } });
        assert.equal(data.rooms, expectedRooms);
        assert.equal(data.liveGameShells >= 1, true);
        assert.equal(data.activeMatches, expectedActive);
        assert.ok(data.memory.rss > 0);
        assert.ok(data.memory.heapUsed > 0);
        assert.ok(data.memory.heapTotal > 0);
        assert.equal(Object.keys(data.memory).sort().join(','), 'heapTotal,heapUsed,rss');
        assertNoSecrets(result.raw);
        assert.doesNotMatch(result.raw, /"cookie"|passwordHash|tokenHash/);

        socketA.close();
        socketB.close();
      });
    } finally {
      await prisma.match.deleteMany({ where: { id: match.id } }).catch(() => undefined);
      await cleanupRoom(created.data.room.id);
      await cleanupEmail(email);
    }
  });

  await test('15 logger drops secrets from metadata', () => {
    const lines: string[] = [];
    const original = console.info;
    console.info = (message?: unknown) => {
      lines.push(String(message));
    };
    try {
      opsLogger.info('server-started', 'test', {
        passwordHash: 'secret',
        cookie: 'sid=abc',
        email: 'a@example.com',
        DATABASE_URL: 'postgresql://user:pass@host/db',
        port: 4000,
      });
    } finally {
      console.info = original;
    }
    assert.equal(lines.length, 1);
    assert.match(lines[0] ?? '', /"event":"server-started"/);
    assert.match(lines[0] ?? '', /"port":4000/);
    assert.doesNotMatch(lines[0] ?? '', /secret|sid=abc|a@example.com|postgresql:\/\//);
  });

  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
