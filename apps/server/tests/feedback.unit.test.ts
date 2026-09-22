import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import {
  consumeFeedbackRateLimit,
  resetFeedbackRateLimiterForTests,
  setFeedbackRateLimiterNowForTests,
} from '../src/modules/feedback/feedback-rate-limit.js';
import {
  inferFeedbackDeviceCategory,
  normalizeFeedbackUserAgent,
} from '../src/modules/feedback/feedback.service.js';
import { createFeedbackSchema } from '../src/modules/feedback/feedback.validation.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

async function withApp<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
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

const valid = {
  category: 'SUGGESTION',
  message: '  اقتراح مفيد  ',
  source: 'GAMEPLAY',
  roomId: 'room_123',
  gameId: 'judge',
  route: '/game',
  submissionId: '123e4567-e89b-42d3-a456-426614174000',
};

const parsed = createFeedbackSchema.parse(valid);
assert.equal(parsed.message, 'اقتراح مفيد');
assert.equal(parsed.category, 'SUGGESTION');
assert.equal(parsed.source, 'GAMEPLAY');

assert.equal(createFeedbackSchema.safeParse({ ...valid, message: '   ' }).success, false);
assert.equal(
  createFeedbackSchema.safeParse({ ...valid, message: 'x'.repeat(2_001) }).success,
  false,
);
assert.equal(createFeedbackSchema.safeParse({ ...valid, category: 'NOPE' }).success, false);
assert.equal(createFeedbackSchema.safeParse({ ...valid, gameId: 'unknown-game' }).success, false);
assert.equal(createFeedbackSchema.safeParse({ ...valid, status: 'RESOLVED' }).success, false);
assert.equal(
  createFeedbackSchema.safeParse({ ...valid, route: '/game?secret=value' }).success,
  false,
);
assert.equal(createFeedbackSchema.safeParse({ ...valid, roomId: 'room id' }).success, false);

let now = 1_000_000;
resetFeedbackRateLimiterForTests();
setFeedbackRateLimiterNowForTests(() => now);
assert.equal(consumeFeedbackRateLimit('203.0.113.1'), true);
assert.equal(consumeFeedbackRateLimit('203.0.113.1'), true);
assert.equal(consumeFeedbackRateLimit('203.0.113.1'), true);
assert.equal(consumeFeedbackRateLimit('203.0.113.1'), false);
assert.equal(consumeFeedbackRateLimit('203.0.113.2'), true);
now += 5 * 60 * 1000;
assert.equal(consumeFeedbackRateLimit('203.0.113.1'), true);
resetFeedbackRateLimiterForTests();

assert.equal(inferFeedbackDeviceCategory('Mozilla/5.0 (iPhone; Mobile)'), 'mobile');
assert.equal(inferFeedbackDeviceCategory('Mozilla/5.0 (Windows NT 10.0)'), 'desktop');
assert.equal(normalizeFeedbackUserAgent(' browser\u0000name '), 'browser name');
assert.equal(normalizeFeedbackUserAgent(null), null);

const schema = read('prisma/schema.prisma');
const feedbackModel = schema.match(/model Feedback \{[\s\S]*?\n\}/)?.[0] ?? '';
assert.match(schema, /model Feedback/);
assert.match(schema, /status\s+FeedbackStatus\s+@default\(NEW\)/);
assert.doesNotMatch(feedbackModel, /ipAddress|fingerprint/i);
assert.match(feedbackModel, /roomId\s+String\?/);
assert.doesNotMatch(feedbackModel, /room\s+Room\??\s+@relation/);

const publicRoutes = read('src/modules/feedback/feedback.routes.ts');
assert.match(publicRoutes, /feedbackRouter\.post\('\/'/);
assert.doesNotMatch(publicRoutes, /feedbackRouter\.(get|patch|delete)/);
assert.match(publicRoutes, /consumeFeedbackRateLimit\(getHttpClientIp\(req\)\)/);

const adminRoutes = read('src/modules/admin/admin.routes.ts');
assert.match(adminRoutes, /get\('\/feedback', requireAdmin/);
assert.match(adminRoutes, /patch\('\/feedback\/:feedbackId', requireAdmin/);
assert.match(adminRoutes, /delete\('\/feedback\/:feedbackId', requireAdmin/);

const service = read('src/modules/feedback/feedback.service.ts');
assert.match(service, /submissionId: input\.submissionId/);
assert.doesNotMatch(service, /password|token|hiddenRole|secretWord|gameState|ipAddress/);

async function main(): Promise<void> {
  await withApp(async (baseUrl) => {
    for (const method of ['GET', 'PATCH', 'DELETE']) {
      const response = await fetch(`${baseUrl}/api/feedback`, { method });
      assert.equal(response.status, 404);
    }

    const malformed = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ category: 'PROBLEM', message: '  ', source: 'LOBBY' }),
    });
    assert.equal(malformed.status, 400);
  });

  console.log('feedback server tests passed');
}

void main();
