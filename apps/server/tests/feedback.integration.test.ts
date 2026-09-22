import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import type {
  AdminActionResponse,
  AdminFeedbackData,
  AdminFeedbackDeleteData,
  AdminFeedbackStatusUpdateData,
  CreateFeedbackData,
  FeedbackActionResponse,
} from '@wanasatna/shared';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { promoteExistingUserToAdmin } from '../src/modules/admin/promote-existing-user.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { registerUser } from '../src/modules/auth/auth.service.js';
import { resetFeedbackRateLimiterForTests } from '../src/modules/feedback/feedback-rate-limit.js';

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
  resetFeedbackRateLimiterForTests();
  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
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
  const suffix = `${Date.now()}.${Math.floor(Math.random() * 1_000_000)}`;
  const adminEmail = `feedback.admin.${suffix}@example.com`;
  const submissionId = randomUUID();
  const createdIds: string[] = [];

  const registered = await registerUser({
    email: adminEmail,
    password: 'password-ok',
    preferredDisplayName: `مسؤول${Math.floor(Math.random() * 900 + 100)}`,
  });
  assert.equal(registered.success, true);
  await promoteExistingUserToAdmin(adminEmail);

  try {
    await withApp(async (baseUrl) => {
      const payload = {
        category: 'PROBLEM',
        message: '  مشكلة واضحة أثناء الجولة  ',
        source: 'GAMEPLAY',
        roomId: `room_${suffix.replace(/\./g, '_')}`,
        gameId: 'judge',
        route: '/game',
        submissionId,
      };
      const createdResponse = await fetch(`${baseUrl}/api/feedback`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (iPhone; Mobile)',
        },
        body: JSON.stringify(payload),
      });
      const created = (await createdResponse.json()) as FeedbackActionResponse<CreateFeedbackData>;
      assert.equal(createdResponse.status, 201);
      assert.equal(created.success, true);
      if (!created.success) throw new Error('feedback creation failed');
      createdIds.push(created.data.id);

      const stored = await prisma.feedback.findUniqueOrThrow({ where: { id: created.data.id } });
      assert.equal(stored.status, 'NEW');
      assert.equal(stored.message, 'مشكلة واضحة أثناء الجولة');
      assert.equal(stored.source, 'GAMEPLAY');
      assert.equal(stored.roomId, payload.roomId);
      assert.equal(stored.gameId, 'judge');
      assert.equal(stored.route, '/game');
      assert.equal(stored.deviceCategory, 'mobile');
      assert.match(stored.userAgent ?? '', /iPhone/);
      assert.equal('ipAddress' in stored, false);

      const duplicateResponse = await fetch(`${baseUrl}/api/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const duplicate =
        (await duplicateResponse.json()) as FeedbackActionResponse<CreateFeedbackData>;
      assert.equal(duplicate.success, true);
      if (duplicate.success) assert.equal(duplicate.data.id, created.data.id);
      assert.equal(await prisma.feedback.count({ where: { submissionId } }), 1);

      const empty = await fetch(`${baseUrl}/api/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, submissionId: randomUUID(), message: '   ' }),
      });
      assert.equal(empty.status, 400);
      const oversized = await fetch(`${baseUrl}/api/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          submissionId: randomUUID(),
          message: 'x'.repeat(2_001),
        }),
      });
      assert.equal(oversized.status, 400);

      for (const [method, path] of [
        ['GET', '/api/feedback'],
        ['GET', `/api/feedback/${created.data.id}`],
        ['PATCH', `/api/feedback/${created.data.id}`],
        ['DELETE', `/api/feedback/${created.data.id}`],
      ] as const) {
        const response = await fetch(`${baseUrl}${path}`, { method });
        assert.equal(response.status, 404);
      }

      for (const [method, path] of [
        ['GET', '/api/admin/feedback'],
        ['PATCH', `/api/admin/feedback/${created.data.id}`],
        ['DELETE', `/api/admin/feedback/${created.data.id}`],
      ] as const) {
        const response = await fetch(`${baseUrl}${path}`, {
          method,
          ...(method === 'PATCH'
            ? {
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ status: 'RESOLVED' }),
              }
            : {}),
        });
        assert.equal(response.status, 401);
      }

      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: 'password-ok' }),
      });
      assert.equal(loginResponse.status, 200);
      const cookie = cookieFromResponse(loginResponse);

      const listResponse = await fetch(
        `${baseUrl}/api/admin/feedback?status=NEW&category=PROBLEM`,
        {
          headers: { cookie },
        },
      );
      const listed = (await listResponse.json()) as AdminActionResponse<AdminFeedbackData>;
      assert.equal(listResponse.status, 200);
      assert.equal(listed.success, true);
      if (!listed.success) throw new Error('admin list failed');
      assert.ok(listed.data.feedback.some((item) => item.id === created.data.id));
      assert.ok(listed.data.stats.total >= 1);
      assert.ok(listed.data.stats.new >= 1);
      assert.ok(listed.data.stats.problems >= 1);

      const patchResponse = await fetch(`${baseUrl}/api/admin/feedback/${created.data.id}`, {
        method: 'PATCH',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'REVIEWED' }),
      });
      const patched =
        (await patchResponse.json()) as AdminActionResponse<AdminFeedbackStatusUpdateData>;
      assert.equal(patchResponse.status, 200);
      assert.equal(patched.success, true);
      assert.equal(
        (await prisma.feedback.findUniqueOrThrow({ where: { id: created.data.id } })).status,
        'REVIEWED',
      );

      const deleteResponse = await fetch(`${baseUrl}/api/admin/feedback/${created.data.id}`, {
        method: 'DELETE',
        headers: { cookie },
      });
      const deleted = (await deleteResponse.json()) as AdminActionResponse<AdminFeedbackDeleteData>;
      assert.equal(deleteResponse.status, 200);
      assert.equal(deleted.success, true);
      assert.equal(await prisma.feedback.count({ where: { id: created.data.id } }), 0);
      createdIds.splice(createdIds.indexOf(created.data.id), 1);
    });

    console.log('feedback database integration tests passed');
  } finally {
    await prisma.feedback.deleteMany({ where: { id: { in: createdIds } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email: adminEmail } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

void main();
