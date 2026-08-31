/**
 * Pre-launch security hardening, Batch 2.
 * Run: pnpm --filter @wanasatna/server test:security-batch2
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveClientIp } from '../src/lib/client-ip.js';
import { opsLogger, sanitizeKnownErrorCode } from '../src/lib/ops-logger.js';
import {
  createLoginAbuseLimiter,
  normalizeLoginIdentifier,
  type LoginAbuseLimiterOptions,
} from '../src/modules/auth/auth-rate-limit.js';

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;

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

function createLimiter(clock: { now: number }, overrides: Partial<LoginAbuseLimiterOptions> = {}) {
  return createLoginAbuseLimiter({
    failureThreshold: 2,
    baseDelayMs: 1_000,
    maxDelayMs: 8_000,
    stateTtlMs: 10_000,
    maxEntries: 20,
    now: () => clock.now,
    ...overrides,
  });
}

function readServer(relativePath: string): string {
  return readFileSync(join(serverRoot, relativePath), 'utf8');
}

async function main(): Promise<void> {
  await test('repeated failures from one IP trigger temporary throttling', () => {
    const clock = { now: 0 };
    const limiter = createLimiter(clock);
    limiter.recordFailure('203.0.113.10', 'first@example.com');
    assert.equal(limiter.check('203.0.113.10', 'second@example.com').allowed, true);
    limiter.recordFailure('203.0.113.10', 'second@example.com');

    const decision = limiter.check('203.0.113.10', 'third@example.com');
    assert.equal(decision.allowed, false);
    assert.equal(decision.retryAfterSeconds, 1);
  });

  await test('normalized email failures aggregate across different IPs', () => {
    const clock = { now: 0 };
    const limiter = createLimiter(clock);
    const identifier = normalizeLoginIdentifier({ email: '  Admin@Example.COM ' });
    assert.equal(identifier, 'admin@example.com');

    limiter.recordFailure('203.0.113.11', identifier);
    limiter.recordFailure('203.0.113.12', normalizeLoginIdentifier({ email: 'ADMIN@example.com' }));
    assert.equal(limiter.check('203.0.113.13', identifier).allowed, false);
    assert.equal(normalizeLoginIdentifier({ email: 'not-an-email' }), null);
  });

  await test('backoff expires, escalates, and success clears temporary state', () => {
    const clock = { now: 0 };
    const limiter = createLimiter(clock, { failureThreshold: 1 });
    const identifier = 'admin@example.com';

    limiter.recordFailure('203.0.113.20', identifier);
    assert.deepEqual(limiter.check('203.0.113.20', identifier), {
      allowed: false,
      retryAfterSeconds: 1,
    });

    clock.now = 1_000;
    assert.equal(limiter.check('203.0.113.20', identifier).allowed, true);
    limiter.recordFailure('203.0.113.20', identifier);
    assert.equal(limiter.check('203.0.113.20', identifier).retryAfterSeconds, 2);

    limiter.recordSuccess('203.0.113.20', identifier);
    assert.equal(limiter.check('203.0.113.20', identifier).allowed, true);
    assert.equal(limiter.size(), 0);
  });

  await test('expired limiter entries are cleaned up', () => {
    const clock = { now: 0 };
    const limiter = createLimiter(clock, { failureThreshold: 10, stateTtlMs: 500 });
    limiter.recordFailure('203.0.113.30', 'admin@example.com');
    assert.equal(limiter.size(), 2);
    clock.now = 500;
    limiter.cleanupExpired();
    assert.equal(limiter.size(), 0);
  });

  await test('limiter state remains within its configured cap', () => {
    const clock = { now: 0 };
    const limiter = createLimiter(clock, { failureThreshold: 10, maxEntries: 3 });
    for (let index = 0; index < 20; index += 1) {
      clock.now = index;
      limiter.recordFailure(`203.0.113.${index + 1}`, `user${index}@example.com`);
      assert.ok(limiter.size() <= 3);
    }
  });

  await test('client IP resolution trusts only the documented proxy chain', () => {
    assert.equal(
      resolveClientIp({
        remoteAddress: '198.51.100.5',
        railwayEdge: 'ruh1',
        xRealIp: '203.0.113.5',
      }),
      '198.51.100.5',
    );
    assert.equal(
      resolveClientIp({
        remoteAddress: '100.1.2.3',
        railwayEdge: 'ruh1',
        xRealIp: '203.0.113.5',
      }),
      '100.1.2.3',
    );
    assert.equal(
      resolveClientIp({
        remoteAddress: '::ffff:100.64.0.2',
        railwayEdge: 'ruh1',
        xRealIp: '203.0.113.5',
      }),
      '203.0.113.5',
    );
    assert.equal(
      resolveClientIp({
        remoteAddress: '100.64.0.2',
        railwayEdge: 'invalid-edge',
        xRealIp: '203.0.113.5',
      }),
      '100.64.0.2',
    );
    assert.equal(
      resolveClientIp({
        remoteAddress: '100.64.0.2',
        railwayEdge: 'ruh1',
        xRealIp: '203.0.113.5, 10.0.0.1',
      }),
      '100.64.0.2',
    );
  });

  await test('Cloudflare client IP is accepted only behind a verified Cloudflare proxy IP', () => {
    assert.equal(
      resolveClientIp({
        remoteAddress: '100.64.0.2',
        railwayEdge: 'ruh1',
        xRealIp: '173.245.48.10',
        cfConnectingIp: '203.0.113.44',
      }),
      '203.0.113.44',
    );
    assert.equal(
      resolveClientIp({
        remoteAddress: '100.64.0.2',
        railwayEdge: 'ruh1',
        xRealIp: '198.51.100.9',
        cfConnectingIp: '203.0.113.44',
      }),
      '198.51.100.9',
    );
  });

  await test('web security headers are explicit and do not introduce a broad CSP or HSTS', async () => {
    const { default: nextConfig, SECURITY_HEADERS } = await import('../../web/next.config.ts');
    const rules = await nextConfig.headers?.();

    assert.deepEqual(rules, [{ source: '/:path*', headers: [...SECURITY_HEADERS] }]);
    assert.deepEqual(
      Object.fromEntries(SECURITY_HEADERS.map((header) => [header.key, header.value])),
      {
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "frame-ancestors 'none'",
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      },
    );
    assert.equal(
      SECURITY_HEADERS.some((header) => header.key === 'Strict-Transport-Security'),
      false,
    );
    assert.doesNotMatch(
      SECURITY_HEADERS.find((header) => header.key === 'Content-Security-Policy')?.value ?? '',
      /default-src|script-src|connect-src|img-src/,
    );
  });

  await test('login enumeration defenses and Retry-After route contract remain present', () => {
    const service = readServer('src/modules/auth/auth.service.ts');
    const route = readServer('src/modules/auth/auth.routes.ts');
    assert.match(service, /verifyPasswordOrDummy\(user\?\.passwordHash \?\? null, password\)/);
    assert.match(service, /if \(!user \|\| !passwordOk\)/);
    assert.match(route, /setHeader\('Retry-After', String\(rateLimit\.retryAfterSeconds\)\)/);
    assert.match(route, /recordLoginFailure\(clientIp, identifier\)/);
    assert.match(route, /recordLoginSuccess\(clientIp, identifier\)/);
  });

  await test('targeted operational paths do not log raw exception messages', () => {
    const targetedFiles = [
      'src/modules/room/services/create-room.service.ts',
      'src/modules/room/room.socket.handlers.ts',
      'src/modules/marathon/marathon.runtime.ts',
      'src/modules/game/game.lifecycle.ts',
      'src/modules/game/game.timer.ts',
      'src/modules/game/runtime/initialize-plugin-on-playing.ts',
      'src/modules/game/plugins/bara-al-salafa/phase-flow.ts',
    ];
    const targetedSource = targetedFiles.map(readServer).join('\n');
    assert.doesNotMatch(targetedSource, /connect to the database/i);
    assert.doesNotMatch(targetedSource, /errorMessage:\s*error instanceof Error/);
    assert.doesNotMatch(
      targetedSource,
      /error:\s*(?:error|abortError) instanceof Error\s*\?\s*(?:error|abortError)\.message/,
    );
    assert.doesNotMatch(targetedSource, /console\.(?:error|warn|info)[^\n]*error\.message/);
  });

  await test('ops logger keeps only safe error metadata', () => {
    const prismaError = Object.assign(new Error('postgresql://user:password@db/internal'), {
      code: 'P1001',
    });
    assert.equal(sanitizeKnownErrorCode(prismaError), 'P1001');
    assert.equal(
      sanitizeKnownErrorCode(Object.assign(new Error('internal'), { code: 'ECONNREFUSED' })),
      undefined,
    );

    const originalConsoleError = console.error;
    const lines: string[] = [];
    console.error = (value?: unknown) => lines.push(String(value));
    try {
      opsLogger.error('safe-error-test', 'تعذر تنفيذ العملية.', {
        operation: 'security-test',
        errorName: prismaError.name,
        errorCode: sanitizeKnownErrorCode(prismaError),
        errorMessage: prismaError.message,
        rawError: prismaError.message,
        password: 'do-not-log',
        authorization: 'Bearer do-not-log',
      });
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(lines.length, 1);
    assert.match(lines[0]!, /"errorName":"Error"/);
    assert.match(lines[0]!, /"errorCode":"P1001"/);
    assert.doesNotMatch(lines[0]!, /postgresql|password|Bearer|ECONNREFUSED/i);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
