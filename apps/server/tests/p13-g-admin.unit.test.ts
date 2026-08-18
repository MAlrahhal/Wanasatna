/**
 * P13-G — Admin Users + Match History browser (read-only).
 * Run: pnpm --filter @wanasatna/server test:p13-g
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MatchStatus } from '@prisma/client';
import {
  ADMIN_HISTORY_PAGE_SIZE,
  ADMIN_USER_MATCH_HISTORY_LIMIT,
  ADMIN_USERS_PAGE_SIZE,
  type AdminActionResponse,
  type AdminHistoryData,
  type AdminMatchDetails,
  type AdminUserDetails,
  type AdminUsersData,
} from '@wanasatna/shared';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { ADMIN_DENIED_MESSAGE } from '../src/modules/admin/require-admin.js';
import { promoteExistingUserToAdmin } from '../src/modules/admin/promote-existing-user.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { registerUser } from '../src/modules/auth/auth.service.js';

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
  return `p13g.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
}

function uniqueName(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 900 + 100)}`;
}

async function cleanupEmail(email: string): Promise<void> {
  await prisma.user.deleteMany({ where: { email } }).catch(() => undefined);
}

async function cleanupMatch(matchId: string | undefined): Promise<void> {
  if (!matchId) {
    return;
  }
  await prisma.match.deleteMany({ where: { id: matchId } }).catch(() => undefined);
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
  assert.doesNotMatch(raw, /AuthSession|reconnectToken/);
  assert.doesNotMatch(raw, /acceptedAnswers|canonical|drawing|strokes|pluginState|gamePhase|socketId/i);
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

async function registerAccount(prefix: string, preferredDisplayName = uniqueName('اسم')) {
  const email = uniqueEmail(prefix);
  const registered = await registerUser({
    email,
    password: 'password-ok',
    preferredDisplayName,
  });
  assert.equal(registered.success, true);
  if (!registered.success || !registered.session) {
    throw new Error('register failed');
  }
  return { email, user: registered.session.user, sessionToken: registered.session.sessionToken };
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
  await test('source: bounded queries, requireAdmin, no mutations or secrets', () => {
    const routes = read('src/modules/admin/admin.routes.ts');
    const users = read('src/modules/admin/admin-users.service.ts');
    const history = read('src/modules/admin/admin-history.service.ts');
    assert.match(routes, /get\('\/users', requireAdmin/);
    assert.match(routes, /get\('\/users\/:userId', requireAdmin/);
    assert.match(routes, /get\('\/history', requireAdmin/);
    assert.match(routes, /get\('\/history\/:matchId', requireAdmin/);
    assert.doesNotMatch(routes, /post\('\/users|patch\('\/users|delete\('\/users/);
    assert.doesNotMatch(routes, /post\('\/history|patch\('\/history|delete\('\/history/);
    assert.match(users, /take: pageSize/);
    assert.match(users, /take: ADMIN_USER_MATCH_HISTORY_LIMIT/);
    assert.match(users, /_count: \{ select: \{ matchParticipations: true \} \}/);
    assert.match(users, /Promise\.all/);
    assert.doesNotMatch(users, /passwordHash|authSession|reconnect/);
    assert.match(history, /take: pageSize/);
    assert.match(history, /_count: \{ select: \{ participants: true \} \}/);
    assert.match(history, /Promise\.all/);
    assert.doesNotMatch(history, /passwordHash|getGameShell|initGameShell|pluginState|playerId/);
    assert.equal(ADMIN_USERS_PAGE_SIZE, 25);
    assert.equal(ADMIN_HISTORY_PAGE_SIZE, 25);
    assert.equal(ADMIN_USER_MATCH_HISTORY_LIMIT, 20);
  });

  await test('1 Guest users API denied', async () => {
    await withApp(async (baseUrl) => {
      const result = await jsonRequest(baseUrl, '/api/admin/users');
      assert.equal(result.status, 401);
      assert.equal(result.body.success, false);
      if (!result.body.success) {
        assert.equal(result.body.error.message, ADMIN_DENIED_MESSAGE);
      }
      assertNoSecrets(result.raw);
    });
  });

  await test('2 USER users API denied', async () => {
    const { email } = await registerAccount('user');
    await withApp(async (baseUrl) => {
      const cookie = await loginCookie(baseUrl, email);
      const headers = { cookie };
      const users = await jsonRequest(baseUrl, '/api/admin/users', { headers });
      assert.equal(users.status, 403);
      const history = await jsonRequest(baseUrl, '/api/admin/history', { headers });
      assert.equal(history.status, 403);
      const spoof = await jsonRequest(baseUrl, '/api/admin/users?role=ADMIN', {
        headers: { cookie, 'x-user-role': 'ADMIN' },
      });
      assert.equal(spoof.status, 403);
    });
    await cleanupEmail(email);
  });

  await test('3-11 ADMIN users list/search/detail safe and bounded', async () => {
    const currentName = uniqueName('حالي');
    const snapshotName = uniqueName('تاريخ');
    const { email: adminEmail } = await registerAccount('admin');
    await promoteExistingUserToAdmin(adminEmail);
    const searched = await registerAccount('search', currentName);
    const extra = await registerAccount('extra');
    const matchIds: string[] = [];

    try {
      const first = await prisma.match.create({
        data: {
          roomCode: 'P13G01',
          gameId: 'bara-al-salafa',
          status: MatchStatus.COMPLETED,
          endedAt: new Date(),
          participants: {
            create: [
              {
                displayName: snapshotName,
                userId: searched.user.id,
                score: 12,
                rank: 1,
                team: 'A',
                isWinner: true,
              },
            ],
          },
        },
      });
      const second = await prisma.match.create({
        data: {
          roomCode: 'P13G02',
          gameId: 'draw-guess',
          status: MatchStatus.ABORTED,
          endedAt: new Date(),
          participants: {
            create: [{ displayName: snapshotName, userId: searched.user.id, score: 0, rank: 2 }],
          },
        },
      });
      matchIds.push(first.id, second.id);

      await withApp(async (baseUrl) => {
        const cookie = await loginCookie(baseUrl, adminEmail);
        const headers = { cookie };

        const listed = await jsonRequest<AdminUsersData>(baseUrl, '/api/admin/users', { headers });
        assert.equal(listed.status, 200);
        assert.equal(listed.body.success, true);
        if (!listed.body.success) {
          throw new Error('list failed');
        }
        assert.ok(listed.body.data.users.length <= ADMIN_USERS_PAGE_SIZE);
        assert.equal(listed.body.data.pageSize, ADMIN_USERS_PAGE_SIZE);
        assertNoSecrets(listed.raw);
        assert.doesNotMatch(listed.raw, /"passwordHash"|AuthSession|"tokenHash"/);

        const byEmail = await jsonRequest<AdminUsersData>(
          baseUrl,
          `/api/admin/users?q=${encodeURIComponent(searched.email)}`,
          { headers },
        );
        assert.equal(byEmail.status, 200);
        assert.equal(byEmail.body.success, true);
        if (!byEmail.body.success) {
          throw new Error('email search failed');
        }
        assert.ok(byEmail.body.data.users.some((user) => user.email === searched.email));

        const byName = await jsonRequest<AdminUsersData>(
          baseUrl,
          `/api/admin/users?q=${encodeURIComponent(currentName)}`,
          { headers },
        );
        assert.equal(byName.status, 200);
        assert.equal(byName.body.success, true);
        if (!byName.body.success) {
          throw new Error('name search failed');
        }
        assert.ok(byName.body.data.users.some((user) => user.preferredDisplayName === currentName));

        const detail = await jsonRequest<AdminUserDetails>(
          baseUrl,
          `/api/admin/users/${searched.user.id}`,
          { headers },
        );
        assert.equal(detail.status, 200);
        assert.equal(detail.body.success, true);
        if (!detail.body.success) {
          throw new Error('detail failed');
        }
        assert.equal(detail.body.data.email, searched.email);
        assert.equal(detail.body.data.matchCount, 2);
        assert.ok(detail.body.data.matches.length <= ADMIN_USER_MATCH_HISTORY_LIMIT);
        assert.ok(detail.body.data.matches.every((row) => row.displayName === snapshotName));
        assert.equal(
          detail.body.data.matches.some((row) => row.displayName === currentName),
          false,
        );
        assert.equal('passwordHash' in detail.body.data, false);
        assert.equal('authSessions' in detail.body.data, false);
        assertNoSecrets(detail.raw);
      });
    } finally {
      await Promise.all(matchIds.map((id) => cleanupMatch(id)));
      await cleanupEmail(searched.email);
      await cleanupEmail(extra.email);
      await cleanupEmail(adminEmail);
    }
  });

  await test('12-22 ADMIN history list/filters/detail; guests not correlated', async () => {
    const { email: adminEmail } = await registerAccount('histadmin');
    await promoteExistingUserToAdmin(adminEmail);
    const linked = await registerAccount('linked', uniqueName('مرتبط'));
    const guestName = uniqueName('ضيف');
    const matchIds: string[] = [];

    try {
      const completed = await prisma.match.create({
        data: {
          roomCode: 'P13GH1',
          gameId: 'draw-guess',
          status: MatchStatus.COMPLETED,
          endedAt: new Date(),
          participants: {
            create: [
              {
                displayName: linked.user.preferredDisplayName,
                userId: linked.user.id,
                score: 9,
                rank: 1,
                isWinner: true,
              },
              { displayName: guestName, score: 1, rank: 2, isWinner: false },
            ],
          },
        },
      });
      const active = await prisma.match.create({
        data: {
          roomCode: 'P13GH2',
          gameId: 'bara-al-salafa',
          status: MatchStatus.ACTIVE,
          participants: {
            create: [{ displayName: guestName }],
          },
        },
      });
      matchIds.push(completed.id, active.id);

      await withApp(async (baseUrl) => {
        const cookie = await loginCookie(baseUrl, adminEmail);
        const headers = { cookie };

        const listed = await jsonRequest<AdminHistoryData>(baseUrl, '/api/admin/history', { headers });
        assert.equal(listed.status, 200);
        assert.equal(listed.body.success, true);
        if (!listed.body.success) {
          throw new Error('history list failed');
        }
        assert.ok(listed.body.data.matches.length <= ADMIN_HISTORY_PAGE_SIZE);
        assert.equal(listed.body.data.pageSize, ADMIN_HISTORY_PAGE_SIZE);
        assertNoSecrets(listed.raw);

        const byGame = await jsonRequest<AdminHistoryData>(
          baseUrl,
          '/api/admin/history?gameId=draw-guess',
          { headers },
        );
        assert.equal(byGame.status, 200);
        assert.equal(byGame.body.success, true);
        if (!byGame.body.success) {
          throw new Error('game filter failed');
        }
        assert.ok(byGame.body.data.matches.every((match) => match.gameId === 'draw-guess'));
        assert.ok(byGame.body.data.matches.some((match) => match.id === completed.id));

        const byStatus = await jsonRequest<AdminHistoryData>(
          baseUrl,
          '/api/admin/history?status=ACTIVE',
          { headers },
        );
        assert.equal(byStatus.status, 200);
        assert.equal(byStatus.body.success, true);
        if (!byStatus.body.success) {
          throw new Error('status filter failed');
        }
        assert.ok(byStatus.body.data.matches.every((match) => match.status === 'ACTIVE'));
        assert.ok(byStatus.body.data.matches.some((match) => match.id === active.id));

        const detail = await jsonRequest<AdminMatchDetails>(
          baseUrl,
          `/api/admin/history/${completed.id}`,
          { headers },
        );
        assert.equal(detail.status, 200);
        assert.equal(detail.body.success, true);
        if (!detail.body.success) {
          throw new Error('match detail failed');
        }
        assert.equal(detail.body.data.participants.length, 2);
        const linkedRow = detail.body.data.participants.find((row) => row.hasLinkedUser);
        const guestRow = detail.body.data.participants.find((row) => !row.hasLinkedUser);
        assert.ok(linkedRow);
        assert.equal(linkedRow.userId, linked.user.id);
        assert.ok(guestRow);
        assert.equal(guestRow.userId, null);
        assert.equal(guestRow.displayName, guestName);
        assert.equal('playerId' in guestRow, false);
        assertNoSecrets(detail.raw);

        const live = await jsonRequest<AdminMatchDetails>(
          baseUrl,
          `/api/admin/history/${active.id}`,
          { headers },
        );
        assert.equal(live.status, 200);
        assert.equal(live.body.success, true);
        if (!live.body.success) {
          throw new Error('active detail failed');
        }
        assert.equal(live.body.data.status, 'ACTIVE');
        assert.equal('gamePhase' in live.body.data, false);
        assert.equal('pluginState' in live.body.data, false);
        assertNoSecrets(live.raw);
      });
    } finally {
      await Promise.all(matchIds.map((id) => cleanupMatch(id)));
      await cleanupEmail(linked.email);
      await cleanupEmail(adminEmail);
    }
  });

  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
