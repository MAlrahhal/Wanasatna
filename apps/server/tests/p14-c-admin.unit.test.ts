/**
 * P14-C — Admin analytics aggregates.
 * Run: pnpm --filter @wanasatna/server test:p14-c
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MatchStatus, ProductEventType, RoomCloseReason } from '@prisma/client';
import {
  ADMIN_ANALYTICS_DEFAULT_RANGE,
  ADMIN_DASHBOARD_GAME_IDS,
  type AdminActionResponse,
  type AdminAnalyticsData,
} from '@wanasatna/shared';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { setSocketServer } from '../src/lib/socket-server.js';
import { getAdminAnalytics, parseAdminAnalyticsRange } from '../src/modules/admin/admin-analytics.service.js';
import { ADMIN_DENIED_MESSAGE } from '../src/modules/admin/require-admin.js';
import { promoteExistingUserToAdmin } from '../src/modules/admin/promote-existing-user.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { registerUser } from '../src/modules/auth/auth.service.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

function riyadhDateKey(value: Date): string {
  return new Date(value.getTime() + 3 * MS_HOUR).toISOString().slice(0, 10);
}

function riyadhHour(value: Date): number {
  return Number(new Date(value.getTime() + 3 * MS_HOUR).toISOString().slice(11, 13));
}

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
  return `p14c.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
}

function uniqueName(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 900 + 100)}`;
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

function assertPrivacy(raw: string, extra: string[] = []): void {
  assert.doesNotMatch(raw, /userId|playerId|passwordHash|tokenHash|reconnectToken/i);
  assert.doesNotMatch(raw, /@example\.com|127\.0\.0\.1|User-Agent|socketId/i);
  assert.doesNotMatch(raw, /chat|stroke|drawing|canonicalAnswer|secret/i);
  for (const value of extra) {
    assert.doesNotMatch(raw, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
}

function gameRow(data: AdminAnalyticsData, gameId: string) {
  return data.games.find((game) => game.gameId === gameId);
}

async function main(): Promise<void> {
  await test('source: aggregate queries only; no schema/tracking/client analytics', () => {
    const service = read('src/modules/admin/admin-analytics.service.ts');
    assert.match(service, /groupBy/);
    assert.match(service, /Prisma\.sql/);
    assert.doesNotMatch(service, /prisma\.productEvent\.findMany/);
    assert.doesNotMatch(service, /prisma\.match\.findMany/);
    assert.doesNotMatch(service, /uniqueUsers|DAU|MAU|fingerprint/);
    assert.match(read('src/modules/admin/admin.routes.ts'), /get\('\/analytics', requireAdmin/);
    assert.doesNotMatch(read('prisma/schema.prisma'), /AnalyticsEvent/);
    const recorder = read('src/modules/analytics/product-event.service.ts');
    assert.doesNotMatch(recorder, /MATCH_STARTED|GAME_STARTED/);
    const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
    assert.equal('recharts' in (pkg.dependencies ?? {}), false);
  });

  await test('1-4 Guest/USER denied; ADMIN allowed; default range 7d', async () => {
    assert.equal(parseAdminAnalyticsRange(undefined), ADMIN_ANALYTICS_DEFAULT_RANGE);
    assert.equal(parseAdminAnalyticsRange('nope'), '7d');
    const { email: userEmail } = await registerAccount('user');
    const { email: adminEmail } = await registerAccount('admin');
    await promoteExistingUserToAdmin(adminEmail);
    try {
      await withApp(async (baseUrl) => {
        const guest = await jsonRequest(baseUrl, '/api/admin/analytics');
        assert.equal(guest.status, 401);
        assert.equal(guest.body.success, false);
        if (!guest.body.success) {
          assert.equal(guest.body.error.message, ADMIN_DENIED_MESSAGE);
        }

        const userCookie = await loginCookie(baseUrl, userEmail);
        const user = await jsonRequest(baseUrl, '/api/admin/analytics', {
          headers: { cookie: userCookie },
        });
        assert.equal(user.status, 403);

        const adminCookie = await loginCookie(baseUrl, adminEmail);
        const admin = await jsonRequest<AdminAnalyticsData>(baseUrl, '/api/admin/analytics', {
          headers: { cookie: adminCookie },
        });
        assert.equal(admin.status, 200);
        assert.equal(admin.body.success, true);
        if (admin.body.success) {
          assert.equal(admin.body.data.range, '7d');
          assert.equal(admin.body.data.games.length, 8);
          for (const gameId of ADMIN_DASHBOARD_GAME_IDS) {
            assert.ok(admin.body.data.games.some((game) => game.gameId === gameId));
          }
          assertPrivacy(admin.raw);
        }
      });
    } finally {
      await cleanupEmail(userEmail);
      await cleanupEmail(adminEmail);
    }
  });

  await test('5-26 range filters, overview, games, participation, daily, privacy', async () => {
    const now = new Date();
    const secretName = `سري-${Date.now()}`;
    const roomCode = '999991';
    const eventIds: string[] = [];
    const matchIds: string[] = [];

    const before24 = await getAdminAnalytics('24h', now);
    const before7 = await getAdminAnalytics('7d', now);
    const before30 = await getAdminAnalytics('30d', now);
    const beforeAll = await getAdminAnalytics('all', now);

    const created24 = await prisma.productEvent.create({
      data: { type: ProductEventType.ROOM_CREATED, roomCap: 8, playerCount: 1, createdAt: now },
    });
    const joined24 = await prisma.productEvent.create({
      data: { type: ProductEventType.ROOM_JOINED, roomCap: 8, playerCount: 2, createdAt: now },
    });
    const spec24 = await prisma.productEvent.create({
      data: { type: ProductEventType.SPECTATOR_JOINED, roomCap: 8, playerCount: 3, createdAt: now },
    });
    const recon24 = await prisma.productEvent.create({
      data: { type: ProductEventType.RECONNECT_SUCCEEDED, roomCap: 8, playerCount: 3, createdAt: now },
    });
    const closed24 = await prisma.productEvent.create({
      data: { type: ProductEventType.ROOM_CLOSED, roomCap: 8, createdAt: now },
    });
    const created2d = await prisma.productEvent.create({
      data: {
        type: ProductEventType.ROOM_CREATED,
        roomCap: 8,
        playerCount: 1,
        createdAt: new Date(now.getTime() - 2 * MS_DAY),
      },
    });
    const created20d = await prisma.productEvent.create({
      data: {
        type: ProductEventType.ROOM_CREATED,
        roomCap: 8,
        playerCount: 1,
        createdAt: new Date(now.getTime() - 20 * MS_DAY),
      },
    });
    eventIds.push(
      created24.id,
      joined24.id,
      spec24.id,
      recon24.id,
      closed24.id,
      created2d.id,
      created20d.id,
    );

    const completed = await prisma.match.create({
      data: {
        roomCode,
        gameId: 'who-wrote-it',
        status: MatchStatus.COMPLETED,
        startedAt: now,
        endedAt: now,
        participants: {
          create: [
            { displayName: secretName, userId: null, playerId: null },
            { displayName: `${secretName}-2`, userId: null, playerId: null },
          ],
        },
      },
    });
    const aborted = await prisma.match.create({
      data: {
        roomCode,
        gameId: 'who-wrote-it',
        status: MatchStatus.ABORTED,
        startedAt: now,
        endedAt: now,
        participants: {
          create: [{ displayName: secretName, userId: null, playerId: null }],
        },
      },
    });
    const active = await prisma.match.create({
      data: {
        roomCode,
        gameId: 'judge',
        status: MatchStatus.ACTIVE,
        startedAt: now,
      },
    });
    const oldMatch = await prisma.match.create({
      data: {
        roomCode,
        gameId: 'fast-answer',
        status: MatchStatus.COMPLETED,
        startedAt: new Date(now.getTime() - 20 * MS_DAY),
        endedAt: new Date(now.getTime() - 20 * MS_DAY),
      },
    });
    matchIds.push(completed.id, aborted.id, active.id, oldMatch.id);

    try {
      const after24 = await getAdminAnalytics('24h', now);
      const after7 = await getAdminAnalytics('7d', now);
      const after30 = await getAdminAnalytics('30d', now);
      const afterAll = await getAdminAnalytics('all', now);

      assert.equal(after24.range, '24h');
      assert.equal(after7.range, '7d');
      assert.equal(after30.range, '30d');
      assert.equal(afterAll.range, 'all');
      assert.equal(afterAll.from, null);
      assert.ok(after24.from);

      assert.equal(after24.overview.roomsCreated, before24.overview.roomsCreated + 1);
      assert.equal(after7.overview.roomsCreated, before7.overview.roomsCreated + 2);
      assert.equal(after30.overview.roomsCreated, before30.overview.roomsCreated + 3);
      assert.equal(afterAll.overview.roomsCreated, beforeAll.overview.roomsCreated + 3);

      assert.equal(after24.overview.roomsJoined, before24.overview.roomsJoined + 1);
      assert.equal(after24.overview.spectatorsJoined, before24.overview.spectatorsJoined + 1);
      assert.equal(after24.overview.reconnectsSucceeded, before24.overview.reconnectsSucceeded + 1);
      assert.equal(after24.overview.roomsClosed, before24.overview.roomsClosed + 1);

      assert.equal(after24.overview.matchesStarted, before24.overview.matchesStarted + 3);
      assert.equal(after24.overview.matchesCompleted, before24.overview.matchesCompleted + 1);
      assert.equal(after24.overview.matchesAborted, before24.overview.matchesAborted + 1);
      assert.equal(after24.overview.matchesActive, before24.overview.matchesActive + 1);

      const denom = after24.overview.matchesCompleted + after24.overview.matchesAborted;
      assert.ok(denom > 0);
      assert.ok(after24.overview.completionRate !== null);
      assert.equal(
        after24.overview.completionRate,
        after24.overview.matchesCompleted / denom,
      );

      const who = gameRow(after24, 'who-wrote-it');
      const whoBefore = gameRow(before24, 'who-wrote-it');
      assert.ok(who && whoBefore);
      assert.equal(who.started, whoBefore.started + 2);
      assert.equal(who.completed, whoBefore.completed + 1);
      assert.equal(who.aborted, whoBefore.aborted + 1);
      assert.equal(who.completionRate, who.completed / (who.completed + who.aborted));

      const judge = gameRow(after24, 'judge');
      const judgeBefore = gameRow(before24, 'judge');
      assert.ok(judge && judgeBefore);
      assert.equal(judge.started, judgeBefore.started + 1);
      assert.equal(judge.completed, judgeBefore.completed);
      assert.equal(judge.aborted, judgeBefore.aborted);
      if (judge.completed + judge.aborted === 0) {
        assert.equal(judge.completionRate, null);
      }

      assert.equal(after24.games.length, 8);
      assert.equal(afterAll.overview.matchesCompleted, beforeAll.overview.matchesCompleted + 2);

      assert.equal(
        after24.participation.totalParticipations,
        before24.participation.totalParticipations + 3,
      );
      assert.ok(after24.participation.averageParticipants !== null);
      assert.equal(
        after24.participation.averageParticipants,
        after24.participation.totalParticipations / after24.overview.matchesStarted,
      );

      assert.equal(after24.startsBySaudiHour.length, 24);
      assert.equal(
        after24.startsBySaudiHour[riyadhHour(now)],
        before24.startsBySaudiHour[riyadhHour(now)] + 3,
      );
      assert.ok(after24.activity.length >= 24);
      assert.equal(who.matchShare, who.started / after24.overview.matchesStarted);
      assert.equal(typeof after24.duration.measuredMatchCount, 'number');
      assert.equal(typeof after24.roomHistory.isPartialForRange, 'boolean');
      assert.ok(Array.isArray(after24.matchSizeDistribution));
      assert.ok(after24.roomHistory.activity.length >= 1);

      assert.ok(after7.daily.length >= 7);
      const todayKey = riyadhDateKey(now);
      const todayRow = after7.daily.find((row) => row.date === todayKey);
      assert.ok(todayRow);
      const todayBefore = before7.daily.find((row) => row.date === todayKey);
      assert.equal(todayRow.roomsCreated, (todayBefore?.roomsCreated ?? 0) + 1);
      assert.equal(todayRow.matchesStarted, (todayBefore?.matchesStarted ?? 0) + 3);
      assert.equal(todayRow.matchesCompleted, (todayBefore?.matchesCompleted ?? 0) + 1);
      assert.equal(todayRow.matchesAborted, (todayBefore?.matchesAborted ?? 0) + 1);
      for (const row of after7.daily) {
        assert.match(row.date, /^\d{4}-\d{2}-\d{2}$/);
        assert.equal(Number.isFinite(row.roomsCreated), true);
      }
      assert.equal(after24.daily.length, 0);

      const payload = JSON.stringify(after24);
      assertPrivacy(payload, [secretName, roomCode]);
      assert.doesNotMatch(payload, /ProductEvent|findMany|password/);
    } finally {
      await prisma.match.deleteMany({ where: { id: { in: matchIds } } });
      await prisma.productEvent.deleteMany({ where: { id: { in: eventIds } } });
    }
  });

  await test('unique participants, valid duration only, room history coverage', async () => {
    const now = new Date();
    const before = await getAdminAnalytics('24h', now);
    const matchIds: string[] = [];
    const historyIds: string[] = [];

    const valid = await prisma.match.create({
      data: {
        roomCode: '999992',
        gameId: 'draw-guess',
        status: MatchStatus.COMPLETED,
        startedAt: now,
        endedAt: new Date(now.getTime() + 30_000),
        participants: {
          create: [
            { displayName: 'dup-name', userId: null, playerId: null },
            { displayName: 'dup-name', userId: null, playerId: null },
          ],
        },
      },
    });
    const invalidDuration = await prisma.match.create({
      data: {
        roomCode: '999992',
        gameId: 'draw-guess',
        status: MatchStatus.ABORTED,
        startedAt: now,
        endedAt: new Date(now.getTime() - 5_000),
      },
    });
    matchIds.push(valid.id, invalidDuration.id);

    const history = await prisma.roomHistory.create({
      data: {
        liveRoomId: `analytics-room-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        roomCode: '999992',
        currentHostPlayerId: 'host-1',
        currentHostName: 'مضيف',
        playerCap: 8,
        isLocked: false,
        createdAt: now,
        historyStartedAt: now,
        closedAt: new Date(now.getTime() + 60_000),
        closeReason: RoomCloseReason.HOST_ENDED,
        participations: {
          create: [
            {
              livePlayerId: 'player-1',
              displayName: 'لاعب',
              joinedAt: now,
              joinedAsSpectator: false,
            },
            {
              livePlayerId: 'spec-1',
              displayName: 'متفرج',
              joinedAt: now,
              joinedAsSpectator: true,
            },
          ],
        },
      },
    });
    historyIds.push(history.id);

    try {
      const after = await getAdminAnalytics('24h', now);
      assert.equal(
        after.participation.totalParticipations,
        before.participation.totalParticipations + 1,
      );
      assert.equal(after.overview.matchesStarted, before.overview.matchesStarted + 2);
      assert.equal(after.duration.measuredMatchCount, before.duration.measuredMatchCount + 1);
      assert.ok(after.duration.averageSeconds !== null);
      const sizeSum = (rows: AdminAnalyticsData['matchSizeDistribution']) =>
        rows.reduce((sum, row) => sum + row.matchCount, 0);
      assert.equal(sizeSum(after.matchSizeDistribution), sizeSum(before.matchSizeDistribution) + 2);
      assert.equal(
        after.roomHistory.roomsCreated,
        (before.roomHistory.roomsCreated ?? 0) + 1,
      );
      const hostEnded = after.roomHistory.closeReasons.find(
        (row) => row.reason === 'HOST_ENDED',
      );
      const hostEndedBefore = before.roomHistory.closeReasons.find(
        (row) => row.reason === 'HOST_ENDED',
      );
      assert.ok(hostEnded);
      assert.equal(hostEnded.roomCount, (hostEndedBefore?.roomCount ?? 0) + 1);
      assert.ok(after.roomHistory.activity.some((row) => row.date === riyadhDateKey(now)));
    } finally {
      await prisma.match.deleteMany({ where: { id: { in: matchIds } } });
      await prisma.roomHistory.deleteMany({ where: { id: { in: historyIds } } });
    }
  });

  await test('18 zero denominator stays null', async () => {
    const empty = {
      completed: 0,
      aborted: 0,
    };
    const denominator = empty.completed + empty.aborted;
    const rate = denominator === 0 ? null : empty.completed / denominator;
    assert.equal(rate, null);
    const data = await getAdminAnalytics('24h');
    const denom = data.overview.matchesCompleted + data.overview.matchesAborted;
    if (denom === 0) {
      assert.equal(data.overview.completionRate, null);
    } else {
      assert.equal(data.overview.completionRate, data.overview.matchesCompleted / denom);
    }
  });

  if (failed > 0) {
    console.error(`\nP14-C failed: ${failed}, passed: ${passed}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nP14-C passed: ${passed}`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
