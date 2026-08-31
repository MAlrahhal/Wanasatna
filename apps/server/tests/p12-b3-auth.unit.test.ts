/**
 * P12-B.3 — optional User + AuthSession foundation.
 * Run: pnpm --filter @wanasatna/server test:p12-b3
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import {
  loginUser,
  logoutAuthSession,
  registerUser,
  resolveAuthSession,
} from '../src/modules/auth/auth.service.js';
import { hashSessionToken } from '../src/modules/auth/session-token.js';
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
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  }
}

function uniqueEmail(prefix: string): string {
  return `p12b3.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
}

async function cleanupEmail(email: string): Promise<void> {
  await prisma.user.deleteMany({ where: { email } }).catch(() => undefined);
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

function firstSetCookie(response: Response): string {
  const cookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie') ?? ''];
  return cookies.find((value) => value.startsWith(`${AUTH_COOKIE_NAME}=`)) ?? '';
}

async function withApp<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
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

async function main(): Promise<void> {
  await test('source: Player stays room-scoped; optional Player.userId; AuthSession kept', () => {
    const schema = read('prisma/schema.prisma');
    assert.match(schema, /enum UserRole \{/);
    assert.match(schema, /model User \{/);
    assert.match(schema, /model AuthSession \{/);
    assert.match(schema, /userId\s+String\?/);
    assert.equal(MAX_ROOM_PLAYERS, 8);
  });

  await test('source: reconnect stays playerId + reconnectToken; sockets may resolve optional account cookie', () => {
    assert.match(read('src/sockets/index.ts'), /attachOptionalSocketAuth/);
    assert.doesNotMatch(read('src/modules/room/services/reconnect.service.ts'), /modules\/auth/);
    assert.match(read('src/modules/room/services/reconnect.service.ts'), /playerId/);
    assert.match(read('src/modules/room/services/reconnect.service.ts'), /reconnectToken/);
    assert.doesNotMatch(read('src/modules/room/services/reconnect.service.ts'), /userId:/);
    assert.doesNotMatch(read('src/modules/auth/password.ts'), /jwt|bcrypt/i);
    assert.match(read('src/modules/auth/password.ts'), /argon2id/);
    assert.doesNotMatch(read('src/config/env.ts'), /ADMIN_EMAILS|adminEmails/);
    assert.doesNotMatch(
      read('src/modules/auth/auth.service.ts'),
      /ADMIN_EMAILS|adminEmails|resolveRole/,
    );
    assert.doesNotMatch(
      read('src/modules/auth/auth.middleware.ts'),
      /role:\s*UserRole\.ADMIN|user\.update/,
    );
    assert.doesNotMatch(read('src/modules/auth/auth.validators.ts'), /\brole\b/);
    assert.doesNotMatch(read('src/modules/auth/auth.routes.ts'), /playerCap|20-player|extended/);
  });

  await test('register hashes password and issues hashed AuthSession', async () => {
    const email = uniqueEmail('reg');
    const registered = await registerUser({
      email,
      password: 'password-ok',
      preferredDisplayName: 'لاعب',
    });
    assert.equal(registered.success, true);
    if (!registered.success || !registered.session) {
      throw new Error('register failed');
    }
    assert.equal(registered.data.user.email, email);
    assert.equal(registered.data.user.preferredDisplayName, 'لاعب');
    assert.equal(registered.data.user.role, 'USER');
    assert.equal('passwordHash' in registered.data.user, false);

    const row = await prisma.user.findUnique({ where: { email } });
    assert.ok(row);
    assert.notEqual(row?.passwordHash, 'password-ok');
    assert.match(row?.passwordHash ?? '', /^\$argon2id\$/);

    const sessions = await prisma.authSession.findMany({ where: { userId: row!.id } });
    assert.equal(sessions.length, 1);
    assert.notEqual(sessions[0]?.tokenHash, registered.session.sessionToken);
    assert.equal(sessions[0]?.tokenHash, hashSessionToken(registered.session.sessionToken));

    await cleanupEmail(email);
  });

  await test('duplicate email is rejected without creating a second User', async () => {
    const email = uniqueEmail('dup');
    const first = await registerUser({
      email,
      password: 'password-ok',
      preferredDisplayName: 'أول',
    });
    const second = await registerUser({
      email,
      password: 'password-ok',
      preferredDisplayName: 'ثاني',
    });
    assert.equal(first.success, true);
    assert.equal(second.success, false);
    if (!second.success) {
      assert.equal(second.error.code, 'EMAIL_TAKEN');
    }
    assert.equal(await prisma.user.count({ where: { email } }), 1);
    await cleanupEmail(email);
  });

  await test('login succeeds with cookie session; wrong password uses generic error', async () => {
    const email = uniqueEmail('login');
    const password = 'password-ok';
    const registered = await registerUser({
      email,
      password,
      preferredDisplayName: 'مضيف',
    });
    assert.equal(registered.success, true);

    const ok = await loginUser({ email, password });
    assert.equal(ok.success, true);
    if (!ok.success || !ok.session) {
      throw new Error('login failed');
    }
    const resolved = await resolveAuthSession(ok.session.sessionToken);
    assert.equal(resolved?.id, ok.data.user.id);

    const wrong = await loginUser({ email, password: 'wrong-password' });
    assert.equal(wrong.success, false);
    if (!wrong.success) {
      assert.equal(wrong.error.code, 'INVALID_CREDENTIALS');
    }

    const missing = await loginUser({
      email: uniqueEmail('missing'),
      password,
    });
    assert.equal(missing.success, false);
    if (!missing.success && !wrong.success) {
      assert.equal(missing.error.code, wrong.error.code);
      assert.equal(missing.error.message, wrong.error.message);
    }

    await cleanupEmail(email);
  });

  await test('logout deletes AuthSession and is idempotent', async () => {
    const email = uniqueEmail('out');
    const registered = await registerUser({
      email,
      password: 'password-ok',
      preferredDisplayName: 'خارج',
    });
    assert.equal(registered.success, true);
    if (!registered.session) {
      throw new Error('missing session');
    }
    await logoutAuthSession(registered.session.sessionToken);
    assert.equal(await resolveAuthSession(registered.session.sessionToken), null);
    await logoutAuthSession(registered.session.sessionToken);
    await cleanupEmail(email);
  });

  await test('expired AuthSession does not authenticate', async () => {
    const email = uniqueEmail('exp');
    const registered = await registerUser({
      email,
      password: 'password-ok',
      preferredDisplayName: 'منته',
    });
    assert.equal(registered.success, true);
    if (!registered.session) {
      throw new Error('missing session');
    }
    await prisma.authSession.updateMany({
      where: { tokenHash: hashSessionToken(registered.session.sessionToken) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    assert.equal(await resolveAuthSession(registered.session.sessionToken), null);
    await cleanupEmail(email);
  });

  await test('register always USER; client role and allowlisted email have no effect', async () => {
    const email = uniqueEmail('role');
    const registered = await registerUser({
      email,
      password: 'password-ok',
      preferredDisplayName: 'لاعب',
      role: 'ADMIN',
    });
    assert.equal(registered.success, true);
    if (!registered.success) {
      throw new Error('register failed');
    }
    assert.equal(registered.data.user.role, 'USER');
    const row = await prisma.user.findUnique({ where: { email } });
    assert.equal(row?.role, 'USER');

    const special = uniqueEmail('admin');
    const specialReg = await registerUser({
      email: special,
      password: 'password-ok',
      preferredDisplayName: 'إدارة',
    });
    assert.equal(specialReg.success, true);
    if (specialReg.success) {
      assert.equal(specialReg.data.user.role, 'USER');
    }
    const specialRow = await prisma.user.findUnique({ where: { email: special } });
    assert.equal(specialRow?.role, 'USER');

    await cleanupEmail(email);
    await cleanupEmail(special);
  });

  await test('login never promotes USER to ADMIN; existing ADMIN remains ADMIN', async () => {
    const userEmail = uniqueEmail('keep');
    const adminEmail = uniqueEmail('stay');
    const registered = await registerUser({
      email: userEmail,
      password: 'password-ok',
      preferredDisplayName: 'عادي',
    });
    assert.equal(registered.success, true);
    const loginUserResult = await loginUser({ email: userEmail, password: 'password-ok' });
    assert.equal(loginUserResult.success, true);
    if (loginUserResult.success) {
      assert.equal(loginUserResult.data.user.role, 'USER');
    }
    const userAfterLogin = await prisma.user.findUnique({ where: { email: userEmail } });
    assert.equal(userAfterLogin?.role, 'USER');

    const adminReg = await registerUser({
      email: adminEmail,
      password: 'password-ok',
      preferredDisplayName: 'أدمن',
    });
    assert.equal(adminReg.success, true);
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: 'ADMIN' },
    });
    const adminLogin = await loginUser({ email: adminEmail, password: 'password-ok' });
    assert.equal(adminLogin.success, true);
    if (adminLogin.success) {
      assert.equal(adminLogin.data.user.role, 'ADMIN');
    }
    const adminAfterLogin = await prisma.user.findUnique({ where: { email: adminEmail } });
    assert.equal(adminAfterLogin?.role, 'ADMIN');

    await cleanupEmail(userEmail);
    await cleanupEmail(adminEmail);
  });

  await test('session resolution never changes role', async () => {
    const email = uniqueEmail('sess');
    const registered = await registerUser({
      email,
      password: 'password-ok',
      preferredDisplayName: 'جلسة',
    });
    assert.equal(registered.success, true);
    if (!registered.session) {
      throw new Error('missing session');
    }
    const before = await prisma.user.findUnique({ where: { email } });
    const resolved = await resolveAuthSession(registered.session.sessionToken);
    const after = await prisma.user.findUnique({ where: { email } });
    assert.equal(resolved?.role, 'USER');
    assert.equal(before?.role, 'USER');
    assert.equal(after?.role, before?.role);
    assert.equal(after?.updatedAt.getTime(), before?.updatedAt.getTime());
    await cleanupEmail(email);
  });

  await test('HTTP register/login/me/logout cookie flow; guests remain unauthenticated', async () => {
    resetAuthRateLimiterForTests();
    const email = uniqueEmail('http');
    await withApp(async (baseUrl) => {
      const health = await fetch(`${baseUrl}/api/health`);
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), { status: 'ok' });

      const guestMe = await fetch(`${baseUrl}/api/auth/me`);
      assert.equal(guestMe.status, 200);
      const guestBody = (await guestMe.json()) as { success: boolean; data: { user: null } };
      assert.equal(guestBody.success, true);
      assert.equal(guestBody.data.user, null);

      const registered = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'password-ok',
          preferredDisplayName: 'ضيف',
        }),
      });
      assert.equal(registered.status, 201);
      const registeredBody = (await registered.json()) as {
        success: boolean;
        data: { user: { email: string; passwordHash?: string } };
        sessionToken?: string;
      };
      assert.equal(registeredBody.success, true);
      assert.equal(registeredBody.data.user.email, email);
      assert.equal(registeredBody.data.user.passwordHash, undefined);
      assert.equal(registeredBody.sessionToken, undefined);
      const setCookie = firstSetCookie(registered);
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=Lax/i);
      assert.doesNotMatch(setCookie, /password/i);
      const cookie = cookieFromResponse(registered);
      assert.match(cookie, new RegExp(`^${AUTH_COOKIE_NAME}=`));

      const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
      const meBody = (await me.json()) as { data: { user: { email: string } | null } };
      assert.equal(meBody.data.user?.email, email);

      const invalidMe = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { cookie: `${AUTH_COOKIE_NAME}=not-a-session` },
      });
      const invalidBody = (await invalidMe.json()) as { data: { user: null } };
      assert.equal(invalidBody.data.user, null);

      const logout = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { cookie },
      });
      assert.equal(logout.status, 200);
      const after = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
      const afterBody = (await after.json()) as { data: { user: null } };
      assert.equal(afterBody.data.user, null);

      const login = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'password-ok' }),
      });
      assert.equal(login.status, 200);
      const loginCookie = cookieFromResponse(login);
      const loggedIn = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: loginCookie } });
      const loggedInBody = (await loggedIn.json()) as { data: { user: { email: string } | null } };
      assert.equal(loggedInBody.data.user?.email, email);
    });
    await cleanupEmail(email);
  });

  await test('login rate limit rejects bursts without leaking credentials', async () => {
    resetAuthRateLimiterForTests();
    await withApp(async (baseUrl) => {
      let limited = 0;
      for (let i = 0; i < 12; i += 1) {
        const response = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: uniqueEmail('rl'),
            password: 'password-ok',
          }),
        });
        if (response.status === 429) {
          limited += 1;
          assert.match(response.headers.get('retry-after') ?? '', /^\d+$/);
          const body = (await response.json()) as { error?: { code?: string } };
          assert.equal(body.error?.code, 'RATE_LIMITED');
        } else {
          await response.json();
        }
      }
      assert.ok(limited >= 1);
    });
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
