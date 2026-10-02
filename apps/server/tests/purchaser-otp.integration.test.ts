/**
 * Purchaser OTP persistence/session integration tests.
 * Requires PURCHASER_OTP_TEST_DATABASE_URL pointing to a disposable loopback PostgreSQL database.
 * Every email transport is injected; this file cannot send real email.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

const configuredDatabaseUrl = process.env.PURCHASER_OTP_TEST_DATABASE_URL?.trim();
if (!configuredDatabaseUrl) {
  throw new Error(
    'PURCHASER_OTP_TEST_DATABASE_URL is required and must point to a disposable local database.',
  );
}

const parsedDatabaseUrl = new URL(configuredDatabaseUrl);
const localHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const databaseName = decodeURIComponent(parsedDatabaseUrl.pathname.replace(/^\//, ''));
if (
  !localHosts.has(parsedDatabaseUrl.hostname.toLowerCase()) ||
  !databaseName.startsWith('wanasatna_purchaser_otp_verify_')
) {
  throw new Error(
    'Refusing purchaser OTP integration tests: the database must be loopback-hosted and use the isolated verification name prefix.',
  );
}

process.env.NODE_ENV = 'test';
process.env.WANASATNA_TEST_MODE = '1';
process.env.TEST_DATABASE_URL = configuredDatabaseUrl;
process.env.DATABASE_URL = 'postgresql://guard:guard@127.0.0.1:1/never_use_this_database';
delete process.env.PRODUCTION_DATABASE_URL;
process.env.PURCHASER_OTP_SECRET = 'integration-secret-with-at-least-thirty-two-characters';
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_FROM_EMAIL;

const EMAIL_SUFFIX = '@otp.local.test';
const NOW = new Date('2026-10-01T12:00:00.000Z');
let passed = 0;
let failed = 0;

type CapturedEmail = {
  to: string;
  code: string;
  expiresInMinutes: number;
  challengeId: string;
  version: number;
};

function email(name: string): string {
  return `${name}.${process.pid}${EMAIL_SUFFIX}`;
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

function cookieFromResponse(response: Response): string {
  const cookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie') ?? ''];
  return cookies.find((value) => value.startsWith('wanasatna_sid=')) ?? '';
}

async function withApp<T>(
  createApp: () => import('express').Express,
  run: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function main(): Promise<void> {
  const { prisma } = await import('../src/lib/prisma.js');
  const { createApp } = await import('../src/app.js');
  const { hashPassword } = await import('../src/modules/auth/password.js');
  const {
    createPurchaserOtpService,
    PURCHASER_OTP_MAX_ATTEMPTS,
    PURCHASER_OTP_RESEND_COOLDOWN_MS,
    PURCHASER_OTP_TTL_MS,
    setPurchaserOtpServiceForTests,
  } = await import('../src/modules/auth/purchaser-otp.service.js');
  const { resetPurchaserOtpRateLimitersForTests } =
    await import('../src/modules/auth/purchaser-otp-rate-limit.js');
  const { hasActiveUserEntitlement } =
    await import('../src/modules/entitlements/entitlement.service.js');

  const deliveries: CapturedEmail[] = [];
  const fakeTransport = {
    isConfigured: () => true,
    async send(message: CapturedEmail) {
      deliveries.push({ ...message });
    },
  };
  const service = createPurchaserOtpService({
    db: prisma,
    emailTransport: fakeTransport,
    otpSecret: process.env.PURCHASER_OTP_SECRET,
  });

  function latestDelivery(to: string): CapturedEmail {
    const delivery = [...deliveries].reverse().find((candidate) => candidate.to === to);
    assert.ok(delivery, `Expected a captured email for ${to}`);
    return delivery;
  }

  async function requestCode(targetEmail: string, now = NOW) {
    const result = await service.requestCode(targetEmail, now);
    assert.equal(result.success, true);
    if (!result.success) {
      throw new Error(result.error.message);
    }
    assert.equal(result.data.delivery, 'sent');
    return { request: result.data, email: latestDelivery(targetEmail) };
  }

  async function createUser(targetEmail: string, role: 'USER' | 'ADMIN' = 'USER') {
    return prisma.user.create({
      data: {
        email: targetEmail,
        passwordHash: await hashPassword(`integration-password-${targetEmail}`),
        preferredDisplayName: role === 'ADMIN' ? 'Admin Test' : 'Buyer Test',
        role,
      },
    });
  }

  async function cleanup(): Promise<void> {
    await prisma.room.deleteMany({ where: { id: { startsWith: `otp-room-${process.pid}` } } });
    await prisma.purchaserEmailOtpChallenge.deleteMany({
      where: { email: { endsWith: EMAIL_SUFFIX } },
    });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } });
  }

  async function expectDatabaseRejection(action: () => Promise<unknown>): Promise<void> {
    let rejected = false;
    try {
      await action();
    } catch {
      rejected = true;
    }
    assert.equal(rejected, true);
  }

  console.log(
    `LOCAL_DB ${parsedDatabaseUrl.hostname}:${parsedDatabaseUrl.port || '5432'}/${databaseName}`,
  );
  await cleanup();
  setPurchaserOtpServiceForTests(service);
  resetPurchaserOtpRateLimitersForTests();

  try {
    await test('database enforces normalized unique email, verifier, attempts, and lifecycle windows', async () => {
      const constraintEmail = email('constraint');
      const validData = {
        id: `constraint-${process.pid}`,
        email: constraintEmail,
        codeHash: 'a'.repeat(64),
        requestedAt: NOW,
        sentAt: NOW,
        expiresAt: new Date(NOW.getTime() + PURCHASER_OTP_TTL_MS),
      };
      await prisma.purchaserEmailOtpChallenge.create({ data: validData });
      await expectDatabaseRejection(() =>
        prisma.purchaserEmailOtpChallenge.create({
          data: { ...validData, id: `${validData.id}-duplicate` },
        }),
      );
      await expectDatabaseRejection(() =>
        prisma.purchaserEmailOtpChallenge.create({
          data: {
            ...validData,
            id: `${validData.id}-uppercase`,
            email: email('UPPERCASE').toUpperCase(),
          },
        }),
      );
      await expectDatabaseRejection(() =>
        prisma.purchaserEmailOtpChallenge.create({
          data: {
            ...validData,
            id: `${validData.id}-hash`,
            email: email('invalid-hash'),
            codeHash: 'not-a-verifier',
          },
        }),
      );
      await expectDatabaseRejection(() =>
        prisma.purchaserEmailOtpChallenge.create({
          data: {
            ...validData,
            id: `${validData.id}-attempts`,
            email: email('invalid-attempts'),
            attempts: PURCHASER_OTP_MAX_ATTEMPTS + 1,
          },
        }),
      );
      await expectDatabaseRejection(() =>
        prisma.purchaserEmailOtpChallenge.create({
          data: {
            ...validData,
            id: `${validData.id}-expiry`,
            email: email('invalid-expiry'),
            expiresAt: NOW,
          },
        }),
      );
      await expectDatabaseRejection(() =>
        prisma.purchaserEmailOtpChallenge.create({
          data: {
            ...validData,
            id: `${validData.id}-consumption`,
            email: email('invalid-consumption'),
            sentAt: null,
            consumedAt: new Date(NOW.getTime() + 1),
          },
        }),
      );
    });

    await test('valid HTTP request and verification issue the canonical cookie session', async () => {
      const targetEmail = email('existing-http');
      const existing = await createUser(targetEmail);

      await withApp(createApp, async (baseUrl) => {
        const requestResponse = await fetch(`${baseUrl}/api/auth/purchaser/request-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: `  ${targetEmail.toUpperCase()}  ` }),
        });
        assert.equal(requestResponse.status, 202);
        const requestBody = (await requestResponse.json()) as {
          success: boolean;
          data: { challengeId: string; resendAfterSeconds: number; delivery: string };
        };
        assert.equal(requestBody.success, true);
        assert.equal(requestBody.data.delivery, 'sent');

        const delivered = latestDelivery(targetEmail);
        const verifyResponse = await fetch(`${baseUrl}/api/auth/purchaser/verify-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeId: requestBody.data.challengeId,
            code: delivered.code,
          }),
        });
        assert.equal(verifyResponse.status, 200);
        assert.match(cookieFromResponse(verifyResponse), /^wanasatna_sid=/);
      });

      assert.equal(await prisma.user.count({ where: { email: targetEmail } }), 1);
      assert.equal(await prisma.authSession.count({ where: { userId: existing.id } }), 1);
    });

    await test('returning purchaser reuses one User and request response does not enumerate it', async () => {
      const returningEmail = email('returning');
      const unknownEmail = email('unknown-enumeration');
      const first = await requestCode(returningEmail);
      const firstVerify = await service.verifyCode(
        { challengeId: first.request.challengeId, code: first.email.code },
        NOW,
      );
      assert.equal(firstVerify.success, true);
      const firstUser = await prisma.user.findUniqueOrThrow({ where: { email: returningEmail } });

      const secondNow = new Date(NOW.getTime() + PURCHASER_OTP_RESEND_COOLDOWN_MS + 1);
      const second = await requestCode(returningEmail, secondNow);
      const secondVerify = await service.verifyCode(
        { challengeId: second.request.challengeId, code: second.email.code },
        secondNow,
      );
      assert.equal(secondVerify.success, true);
      const secondUser = await prisma.user.findUniqueOrThrow({ where: { email: returningEmail } });
      assert.equal(secondUser.id, firstUser.id);
      assert.equal(await prisma.user.count({ where: { email: returningEmail } }), 1);

      const knownRequest = await service.requestCode(
        returningEmail,
        new Date(secondNow.getTime() + 1),
      );
      const unknownRequest = await service.requestCode(unknownEmail, secondNow);
      assert.equal(knownRequest.success, true);
      assert.equal(unknownRequest.success, true);
      if (knownRequest.success && unknownRequest.success) {
        assert.deepEqual(
          Object.keys(knownRequest.data).sort(),
          Object.keys(unknownRequest.data).sort(),
        );
        assert.equal(knownRequest.data.resendAfterSeconds, unknownRequest.data.resendAfterSeconds);
      }
    });

    await test('expired, incorrect, replayed, and over-attempt-limit codes fail', async () => {
      const expiredEmail = email('expired');
      const expired = await requestCode(expiredEmail);
      assert.equal(
        (
          await service.verifyCode(
            { challengeId: expired.request.challengeId, code: expired.email.code },
            new Date(NOW.getTime() + PURCHASER_OTP_TTL_MS),
          )
        ).success,
        false,
      );

      const replayEmail = email('replay');
      const replay = await requestCode(replayEmail);
      assert.equal(
        (
          await service.verifyCode(
            { challengeId: replay.request.challengeId, code: replay.email.code },
            NOW,
          )
        ).success,
        true,
      );
      const replayed = await service.verifyCode(
        { challengeId: replay.request.challengeId, code: replay.email.code },
        NOW,
      );
      assert.equal(replayed.success, false);
      if (!replayed.success) {
        assert.equal(replayed.error.code, 'OTP_INVALID');
      }

      const attemptsEmail = email('attempts');
      const attempts = await requestCode(attemptsEmail);
      const wrongCode = attempts.email.code === '999999' ? '000000' : '999999';
      for (let index = 0; index < PURCHASER_OTP_MAX_ATTEMPTS; index += 1) {
        const incorrect = await service.verifyCode(
          { challengeId: attempts.request.challengeId, code: wrongCode },
          NOW,
        );
        assert.equal(incorrect.success, false);
      }
      const blockedCorrect = await service.verifyCode(
        { challengeId: attempts.request.challengeId, code: attempts.email.code },
        NOW,
      );
      assert.equal(blockedCorrect.success, false);
      const stored = await prisma.purchaserEmailOtpChallenge.findUniqueOrThrow({
        where: { id: attempts.request.challengeId },
      });
      assert.equal(stored.attempts, PURCHASER_OTP_MAX_ATTEMPTS);
    });

    await test('concurrent verification consumes one code and issues one session only', async () => {
      const targetEmail = email('concurrent');
      const challenge = await requestCode(targetEmail);
      const results = await Promise.all([
        service.verifyCode(
          { challengeId: challenge.request.challengeId, code: challenge.email.code },
          NOW,
        ),
        service.verifyCode(
          { challengeId: challenge.request.challengeId, code: challenge.email.code },
          NOW,
        ),
      ]);
      assert.equal(results.filter((result) => result.success).length, 1);
      assert.equal(results.filter((result) => !result.success).length, 1);
      const user = await prisma.user.findUniqueOrThrow({ where: { email: targetEmail } });
      assert.equal(await prisma.authSession.count({ where: { userId: user.id } }), 1);
    });

    await test('resend cooldown sends once and delivery failure leaves no usable challenge', async () => {
      const cooldownEmail = email('cooldown');
      const before = deliveries.length;
      const first = await service.requestCode(cooldownEmail, NOW);
      const second = await service.requestCode(cooldownEmail, new Date(NOW.getTime() + 1_000));
      assert.equal(first.success, true);
      assert.equal(second.success, true);
      assert.equal(deliveries.length - before, 1);
      if (first.success && second.success) {
        assert.equal(second.data.challengeId, first.data.challengeId);
        assert.equal(second.data.delivery, 'sent');
      }

      const failedEmail = email('delivery-failure');
      const failingService = createPurchaserOtpService({
        db: prisma,
        emailTransport: {
          isConfigured: () => true,
          async send() {
            throw new Error('injected delivery failure');
          },
        },
        otpSecret: process.env.PURCHASER_OTP_SECRET,
      });
      const failed = await failingService.requestCode(failedEmail, NOW);
      assert.equal(failed.success, false);
      if (!failed.success) {
        assert.equal(failed.error.code, 'EMAIL_DELIVERY_UNAVAILABLE');
      }
      assert.equal(
        await prisma.purchaserEmailOtpChallenge.count({ where: { email: failedEmail } }),
        0,
      );

      let unconfiguredSends = 0;
      const unconfiguredService = createPurchaserOtpService({
        db: prisma,
        emailTransport: {
          isConfigured: () => false,
          async send() {
            unconfiguredSends += 1;
          },
        },
        otpSecret: undefined,
      });
      const unavailableEmail = email('missing-config');
      const unavailable = await unconfiguredService.requestCode(unavailableEmail, NOW);
      assert.equal(unavailable.success, false);
      assert.equal(unconfiguredSends, 0);
      assert.equal(
        await prisma.purchaserEmailOtpChallenge.count({ where: { email: unavailableEmail } }),
        0,
      );
    });

    await test('admin email collision consumes the code without creating a session', async () => {
      const adminEmail = email('admin-collision');
      const admin = await createUser(adminEmail, 'ADMIN');
      const challenge = await requestCode(adminEmail);
      const result = await service.verifyCode(
        { challengeId: challenge.request.challengeId, code: challenge.email.code },
        NOW,
      );
      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error.code, 'OTP_INVALID');
      }
      assert.equal(await prisma.authSession.count({ where: { userId: admin.id } }), 0);
      assert.equal(
        (await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).role,
        'ADMIN',
      );
      assert.ok(
        (
          await prisma.purchaserEmailOtpChallenge.findUniqueOrThrow({
            where: { id: challenge.request.challengeId },
          })
        ).consumedAt,
      );
    });

    await test('sign-in grants no entitlement and leaves live guest identity unchanged', async () => {
      const targetEmail = email('guest-isolation');
      const roomId = `otp-room-${process.pid}-guest`;
      const playerId = `otp-player-${process.pid}-guest`;

      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET CONSTRAINTS ALL DEFERRED`;
        await tx.room.create({
          data: {
            id: roomId,
            code: String(700000 + (process.pid % 100000)).padStart(6, '0'),
            hostPlayerId: playerId,
            status: 'LOBBY',
            gameSettings: { game: 'drawing', roundSeconds: 60 },
          },
        });
        await tx.player.create({
          data: {
            id: playerId,
            roomId,
            name: 'Guest Before OTP',
            reconnectTokenHash: 'guest-reconnect-hash-before-otp',
            userId: null,
          },
        });
      });

      const challenge = await requestCode(targetEmail);
      const result = await service.verifyCode(
        { challengeId: challenge.request.challengeId, code: challenge.email.code },
        NOW,
      );
      assert.equal(result.success, true);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      const user = await prisma.user.findUniqueOrThrow({ where: { email: targetEmail } });
      assert.equal(
        await hasActiveUserEntitlement({
          userId: user.id,
          entitlementKey: 'premium.access',
          at: NOW,
        }),
        false,
      );

      const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
      const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
      assert.equal(player.userId, null);
      assert.equal(player.reconnectTokenHash, 'guest-reconnect-hash-before-otp');
      assert.equal(room.hostPlayerId, playerId);
      assert.equal(room.status, 'LOBBY');
      assert.deepEqual(room.gameSettings, { game: 'drawing', roundSeconds: 60 });
    });
  } finally {
    setPurchaserOtpServiceForTests(null);
    resetPurchaserOtpRateLimitersForTests();
    await cleanup();
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

void main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
