/**
 * P13-A — Admin access foundation.
 * Run: pnpm --filter @wanasatna/server test:p13-a
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { ADMIN_DENIED_MESSAGE, authorizeAdmin } from '../src/modules/admin/require-admin.js';
import { promoteExistingUserToAdmin } from '../src/modules/admin/promote-existing-user.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import {
  loginUser,
  logoutAuthSession,
  registerUser,
  resolveAuthSession,
} from '../src/modules/auth/auth.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';

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
  return `p13a.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
}

function uniqueName(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 900 + 100)}`;
}

async function cleanupEmail(email: string): Promise<void> {
  await prisma.user.deleteMany({ where: { email } }).catch(() => undefined);
}

async function cleanupRoom(roomId: string): Promise<void> {
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

async function registerAccount(prefix: string, name = 'لاعب') {
  const email = uniqueEmail(prefix);
  const registered = await registerUser({
    email,
    password: 'password-ok',
    preferredDisplayName: name,
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

async function getAdminMe(
  baseUrl: string,
  init: RequestInit = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}/api/admin/me`, init);
  const body = (await response.json()) as Record<string, unknown>;
  return { status: response.status, body };
}

async function main(): Promise<void> {
  resetAuthRateLimiterForTests();

  await test('source: ADMIN comes from DB role; no ADMIN_EMAILS; bootstrap is not HTTP', () => {
    assert.doesNotMatch(read('src/config/env.ts'), /ADMIN_EMAILS|adminEmails/);
    assert.doesNotMatch(
      read('src/modules/admin/require-admin.ts'),
      /ADMIN_EMAILS|req\.query|req\.body/,
    );
    assert.match(read('src/modules/admin/require-admin.ts'), /resolveAuthSession/);
    assert.match(read('src/modules/admin/require-admin.ts'), /user\.role !== 'ADMIN'/);
    assert.match(read('src/modules/admin/admin.routes.ts'), /requireAdmin/);
    assert.doesNotMatch(read('src/modules/admin/admin.routes.ts'), /promoteExistingUserToAdmin/);
    assert.match(read('src/routes/index.ts'), /apiRouter\.use\("\/admin", adminRouter\)/);
    assert.doesNotMatch(read('src/index.ts'), /admin/i);
    assert.doesNotMatch(read('src/modules/room/services/reconnect.service.ts'), /modules\/admin/);
    assert.doesNotMatch(
      read('scripts/promote-admin.ts'),
      /createApp|Router|passwordHash|sessionToken/,
    );
    assert.match(read('src/modules/admin/promote-existing-user.ts'), /prisma\.user\.findUnique/);
    assert.match(read('src/modules/admin/promote-existing-user.ts'), /prisma\.\$transaction/);
    assert.match(read('src/modules/admin/promote-existing-user.ts'), /tx\.authSession\.deleteMany/);
    assert.doesNotMatch(read('src/modules/admin/promote-existing-user.ts'), /prisma\.user\.create/);
  });

  await test('authorizeAdmin ignores missing user and USER role', () => {
    const guest = authorizeAdmin(null);
    assert.equal(guest.ok, false);
    if (!guest.ok) {
      assert.equal(guest.status, 401);
      assert.equal(guest.message, ADMIN_DENIED_MESSAGE);
    }

    const user = authorizeAdmin({
      id: 'user-1',
      email: 'user@example.com',
      preferredDisplayName: 'لاعب',
      role: 'USER',
    });
    assert.equal(user.ok, false);
    if (!user.ok) {
      assert.equal(user.status, 403);
      assert.equal(user.message, ADMIN_DENIED_MESSAGE);
    }

    const admin = authorizeAdmin({
      id: 'admin-1',
      email: 'admin@example.com',
      preferredDisplayName: 'مدير',
      role: 'ADMIN',
    });
    assert.equal(admin.ok, true);
  });

  await test('1 Guest cannot access Admin', async () => {
    await withApp(async (baseUrl) => {
      const result = await getAdminMe(baseUrl);
      assert.equal(result.status, 401);
      assert.equal(result.body.success, false);
      const error = result.body.error as { message?: string };
      assert.equal(error.message, ADMIN_DENIED_MESSAGE);
      assert.equal(result.body.data, undefined);
    });
  });

  await test('2 USER cannot access Admin', async () => {
    const { email } = await registerAccount('user');
    await withApp(async (baseUrl) => {
      const cookie = await loginCookie(baseUrl, email);
      const result = await getAdminMe(baseUrl, { headers: { cookie } });
      assert.equal(result.status, 403);
      const error = result.body.error as { message?: string };
      assert.equal(error.message, ADMIN_DENIED_MESSAGE);
    });
    await cleanupEmail(email);
  });

  await test('3 ADMIN can access Admin with safe DTO only', async () => {
    const { email } = await registerAccount('admin', 'مدير');
    await promoteExistingUserToAdmin(email);
    await withApp(async (baseUrl) => {
      const cookie = await loginCookie(baseUrl, email);
      const result = await getAdminMe(baseUrl, { headers: { cookie } });
      assert.equal(result.status, 200);
      const data = result.body.data as { user: Record<string, unknown> };
      assert.equal(data.user.email, email);
      assert.equal(data.user.role, 'ADMIN');
      assert.equal(data.user.preferredDisplayName, 'مدير');
      assert.deepEqual(Object.keys(data.user).sort(), [
        'email',
        'id',
        'preferredDisplayName',
        'role',
      ]);
      const serialized = JSON.stringify(result.body);
      assert.doesNotMatch(serialized, /passwordHash|tokenHash|reconnectToken|prisma/i);
    });
    await cleanupEmail(email);
  });

  await test('4 client role spoofing ignored', async () => {
    const { email } = await registerAccount('spoof');
    await withApp(async (baseUrl) => {
      const cookie = await loginCookie(baseUrl, email);
      const result = await getAdminMe(baseUrl, {
        headers: {
          cookie,
          'x-user-role': 'ADMIN',
        },
      });
      const spoofedQuery = await fetch(`${baseUrl}/api/admin/me?role=ADMIN`, {
        headers: { cookie },
      });
      assert.equal(result.status, 403);
      assert.equal(spoofedQuery.status, 403);
    });
    await cleanupEmail(email);
  });

  await test('5 email alone does not grant Admin', async () => {
    const { email } = await registerAccount('emaileak');
    await promoteExistingUserToAdmin(email);
    await withApp(async (baseUrl) => {
      const result = await fetch(`${baseUrl}/api/admin/me?email=${encodeURIComponent(email)}`);
      assert.equal(result.status, 401);
      const body = (await result.json()) as { success: boolean };
      assert.equal(body.success, false);
    });
    await cleanupEmail(email);
  });

  await test('6 Player.userId alone does not grant Admin', async () => {
    const { email, registered } = await registerAccount('player');
    const created = await createRoom({ playerName: uniqueName('مضيف') }, registered.data.user.id);
    assert.equal(created.success, true);
    if (!created.success) {
      throw new Error('create room failed');
    }

    try {
      const player = await prisma.player.findUnique({ where: { id: created.data.player.id } });
      assert.equal(player?.userId, registered.data.user.id);

      await withApp(async (baseUrl) => {
        const cookie = await loginCookie(baseUrl, email);
        const asUser = await getAdminMe(baseUrl, {
          headers: { cookie, 'x-player-user-id': registered.data.user.id },
        });
        assert.equal(asUser.status, 403);

        const asGuest = await getAdminMe(baseUrl, {
          headers: { 'x-player-user-id': registered.data.user.id },
        });
        assert.equal(asGuest.status, 401);
      });
    } finally {
      await cleanupRoom(created.data.room.id);
      await cleanupEmail(email);
    }
  });

  await test('7 expired AuthSession denied', async () => {
    const { email, registered } = await registerAccount('expired');
    await promoteExistingUserToAdmin(email);
    if (!registered.session) {
      throw new Error('missing session');
    }

    await prisma.authSession.updateMany({
      where: { userId: registered.data.user.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await withApp(async (baseUrl) => {
      const cookie = `${AUTH_COOKIE_NAME}=${registered.session!.sessionToken}`;
      const result = await getAdminMe(baseUrl, { headers: { cookie } });
      assert.equal(result.status, 401);
    });
    await cleanupEmail(email);
  });

  await test('8 logout denies subsequent Admin access', async () => {
    const { email } = await registerAccount('logout');
    await promoteExistingUserToAdmin(email);
    await withApp(async (baseUrl) => {
      const cookie = await loginCookie(baseUrl, email);
      const before = await getAdminMe(baseUrl, { headers: { cookie } });
      assert.equal(before.status, 200);

      const logout = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { cookie },
      });
      assert.equal(logout.status, 200);

      const after = await getAdminMe(baseUrl, { headers: { cookie } });
      assert.equal(after.status, 401);
    });
    await cleanupEmail(email);
  });

  await test('9 Admin login with USER credentials is unauthorized', async () => {
    const { email } = await registerAccount('userlogin');
    await withApp(async (baseUrl) => {
      const login = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'password-ok' }),
      });
      assert.equal(login.status, 200);
      const loginBody = (await login.json()) as { data: { user: { role: string } } };
      assert.equal(loginBody.data.user.role, 'USER');
      const cookie = cookieFromResponse(login);
      const admin = await getAdminMe(baseUrl, { headers: { cookie } });
      assert.equal(admin.status, 403);
      const error = admin.body.error as { message?: string };
      assert.equal(error.message, ADMIN_DENIED_MESSAGE);
    });
    await cleanupEmail(email);
  });

  await test('10 promotion revokes every old AuthSession and requires a fresh login', async () => {
    const { email, registered } = await registerAccount('promote');
    if (!registered.session) {
      throw new Error('missing session');
    }

    const secondLogin = await loginUser({ email, password: 'password-ok' });
    assert.equal(secondLogin.success, true);
    if (!secondLogin.success || !secondLogin.session) {
      throw new Error('second login failed');
    }
    assert.equal(await prisma.authSession.count({ where: { userId: registered.data.user.id } }), 2);

    const before = await resolveAuthSession(registered.session.sessionToken);
    assert.equal(before?.role, 'USER');

    const missing = uniqueEmail('nobody');
    await assert.rejects(() => promoteExistingUserToAdmin(missing), /No matching User/);
    assert.equal(await prisma.user.count({ where: { email: missing } }), 0);

    const promoted = await promoteExistingUserToAdmin(registered.data.user.id);
    assert.equal(promoted.role, 'ADMIN');
    assert.equal(promoted.email, email);

    const after = await resolveAuthSession(registered.session.sessionToken);
    assert.equal(after, null);
    assert.equal(await resolveAuthSession(secondLogin.session.sessionToken), null);
    assert.equal(await prisma.authSession.count({ where: { userId: registered.data.user.id } }), 0);

    await withApp(async (baseUrl) => {
      const oldCookie = `${AUTH_COOKIE_NAME}=${registered.session!.sessionToken}`;
      const oldSessionResult = await getAdminMe(baseUrl, { headers: { cookie: oldCookie } });
      assert.equal(oldSessionResult.status, 401);

      const freshCookie = await loginCookie(baseUrl, email);
      const freshSessionResult = await getAdminMe(baseUrl, {
        headers: { cookie: freshCookie },
      });
      assert.equal(freshSessionResult.status, 200);
      const data = freshSessionResult.body.data as { user: { role: string } };
      assert.equal(data.user.role, 'ADMIN');
    });
    await cleanupEmail(email);
  });

  await test('12 no user-promote HTTP; room admin is requireAdmin-gated', async () => {
    await withApp(async (baseUrl) => {
      const promote = await fetch(`${baseUrl}/api/admin/promote`, { method: 'POST' });
      assert.equal(promote.status, 404);
      const users = await fetch(`${baseUrl}/api/admin/users`);
      assert.equal(users.status, 401);
      const rooms = await fetch(`${baseUrl}/api/admin/rooms`);
      assert.equal(rooms.status, 401);
      const raw = await rooms.text();
      assert.doesNotMatch(raw, /passwordHash|tokenHash|reconnectToken|P2025|Prisma/);
    });
  });

  await test('13 Room/reconnect unaffected by account logout', async () => {
    const { email, registered } = await registerAccount('room');
    await promoteExistingUserToAdmin(email);
    const created = await createRoom({ playerName: uniqueName('مضيف') }, registered.data.user.id);
    assert.equal(created.success, true);
    if (!created.success) {
      throw new Error('create room failed');
    }

    try {
      const before = await prisma.player.findUnique({ where: { id: created.data.player.id } });
      assert.ok(before);
      assert.equal(before.userId, registered.data.user.id);
      assert.ok(before.reconnectTokenHash);

      await logoutAuthSession(registered.session?.sessionToken);
      const after = await prisma.player.findUnique({ where: { id: created.data.player.id } });
      assert.equal(after?.id, before.id);
      assert.equal(after?.userId, before.userId);
      assert.equal(after?.reconnectTokenHash, before.reconnectTokenHash);
      assert.equal(after?.status, before.status);
    } finally {
      await cleanupRoom(created.data.room.id);
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
