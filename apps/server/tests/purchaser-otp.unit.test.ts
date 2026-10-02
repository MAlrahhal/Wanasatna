/**
 * Purchaser OTP crypto, transport, limiter, validation, and source-contract tests.
 * No database connection and no real email delivery.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.WANASATNA_TEST_MODE = '1';
process.env.TEST_DATABASE_URL = 'postgresql://unit:unit@127.0.0.1:1/wanasatna_purchaser_otp_unit';
delete process.env.DATABASE_URL;
delete process.env.PRODUCTION_DATABASE_URL;

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

async function main(): Promise<void> {
  const {
    generatePurchaserOtpCode,
    hashPurchaserOtpCode,
    isPurchaserOtpSecretConfigured,
    purchaserOtpHashMatches,
  } = await import('../src/modules/auth/purchaser-otp.crypto.js');
  const { createResendPurchaserOtpEmailTransport, purchaserOtpEmailText } =
    await import('../src/modules/auth/purchaser-otp.email.js');
  const { createPurchaserOtpRequestLimiter } =
    await import('../src/modules/auth/purchaser-otp-rate-limit.js');
  const { createPurchaserOtpService } =
    await import('../src/modules/auth/purchaser-otp.service.js');
  const { validatePurchaserOtpRequestPayload, validatePurchaserOtpVerificationPayload } =
    await import('../src/modules/auth/auth.validators.js');

  await test('numeric OTP generation uses exactly six digits', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generatePurchaserOtpCode()));
    assert.ok(codes.size > 1);
    for (const code of codes) {
      assert.match(code, /^\d{6}$/);
    }
  });

  await test('HMAC verifier is secret-held, context-bound, and constant-time comparable', () => {
    const secret = 'test-secret-with-at-least-thirty-two-characters';
    const hash = hashPurchaserOtpCode(secret, 'challenge-a', 'buyer@example.test', '012345');
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.equal(hash.includes('012345'), false);
    assert.equal(purchaserOtpHashMatches(hash, hash), true);
    assert.equal(
      purchaserOtpHashMatches(
        hashPurchaserOtpCode(secret, 'challenge-a', 'buyer@example.test', '654321'),
        hash,
      ),
      false,
    );
    assert.notEqual(
      hashPurchaserOtpCode(secret, 'challenge-b', 'buyer@example.test', '012345'),
      hash,
    );
    assert.equal(isPurchaserOtpSecretConfigured('short'), false);
    assert.equal(isPurchaserOtpSecretConfigured(secret), true);
  });

  await test('Resend transport sends only through the injected boundary with idempotency', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const transport = createResendPurchaserOtpEmailTransport({
      apiKey: 'test-api-key',
      from: 'Wanasatna <access@example.test>',
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), init });
        return new Response(JSON.stringify({ id: 'email-test-id' }), { status: 200 });
      },
    });

    assert.equal(transport.isConfigured(), true);
    await transport.send({
      to: 'buyer@example.test',
      code: '012345',
      expiresInMinutes: 10,
      challengeId: 'challenge-id',
      version: 3,
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, 'https://api.resend.com/emails');
    const headers = calls[0]?.init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer test-api-key');
    assert.equal(headers['Idempotency-Key'], 'purchaser-otp/challenge-id/3');
    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    assert.deepEqual(body.to, ['buyer@example.test']);
    assert.match(String(body.text), /012345/);
    assert.match(String(body.text), /10/);
  });

  await test('missing or failed email configuration never reports a sent challenge', async () => {
    let fetchCalls = 0;
    const unconfigured = createResendPurchaserOtpEmailTransport({
      apiKey: undefined,
      from: undefined,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response(null, { status: 200 });
      },
    });
    assert.equal(unconfigured.isConfigured(), false);
    await assert.rejects(
      unconfigured.send({
        to: 'buyer@example.test',
        code: '012345',
        expiresInMinutes: 10,
        challengeId: 'challenge-id',
        version: 1,
      }),
    );
    assert.equal(fetchCalls, 0);

    let sends = 0;
    const service = createPurchaserOtpService({
      db: {} as never,
      emailTransport: {
        isConfigured: () => false,
        async send() {
          sends += 1;
        },
      },
      otpSecret: undefined,
    });
    const result = await service.requestCode('buyer@example.test');
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.code, 'EMAIL_DELIVERY_UNAVAILABLE');
    }
    assert.equal(sends, 0);
  });

  await test('request limiter enforces both email and network budgets without partial charges', () => {
    let now = 1_000_000;
    const limiter = createPurchaserOtpRequestLimiter({
      networkCapacity: 2,
      emailCapacity: 1,
      windowMs: 60_000,
      stateTtlMs: 120_000,
      maxEntries: 100,
      now: () => now,
    });

    assert.equal(limiter.consume('203.0.113.1', 'one@example.test').allowed, true);
    assert.equal(limiter.consume('203.0.113.1', 'one@example.test').allowed, false);
    assert.equal(limiter.consume('203.0.113.1', 'two@example.test').allowed, true);
    assert.equal(limiter.consume('203.0.113.1', 'three@example.test').allowed, false);
    now += 60_000;
    assert.equal(limiter.consume('203.0.113.1', 'one@example.test').allowed, true);
  });

  await test('purchaser payload validation normalizes email and accepts only six numeric digits', () => {
    const request = validatePurchaserOtpRequestPayload({ email: '  Buyer@Example.Test ' });
    assert.equal(request.success, true);
    if (request.success) {
      assert.equal(request.data.email, 'buyer@example.test');
    }

    assert.equal(
      validatePurchaserOtpVerificationPayload({
        challengeId: 'a'.repeat(32),
        code: '012345',
      }).success,
      true,
    );
    assert.equal(
      validatePurchaserOtpVerificationPayload({
        challengeId: 'a'.repeat(32),
        code: '12345x',
      }).success,
      false,
    );
  });

  await test('migration is additive and constrains lifecycle state', () => {
    const migration = read(
      'prisma/migrations/20260929120000_add_purchaser_email_otp_challenge/migration.sql',
    );
    assert.match(migration, /CREATE TABLE "PurchaserEmailOtpChallenge"/);
    assert.match(migration, /"email" VARCHAR\(254\) NOT NULL/);
    assert.match(migration, /"codeHash" CHAR\(64\) NOT NULL/);
    assert.match(migration, /"attempts" BETWEEN 0 AND 5/);
    assert.match(migration, /"expiresAt" > "requestedAt"/);
    assert.match(migration, /"consumedAt" IS NULL/);
    assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE|DELETE FROM)\b/i);
    assert.doesNotMatch(migration, /ALTER TABLE "(?:User|AuthSession|Player|Room)"/);
  });

  await test('purchaser flow cannot issue entitlements or mutate room identity', () => {
    const service = read('src/modules/auth/purchaser-otp.service.ts');
    const routes = read('src/modules/auth/purchaser-otp.routes.ts');
    const email = read('src/modules/auth/purchaser-otp.email.ts');
    assert.doesNotMatch(
      `${service}\n${routes}`,
      /entitlementGrant|Player|hostPlayerId|reconnectToken/,
    );
    assert.doesNotMatch(`${service}\n${routes}`, /grant.*entitlement|premium\s*:/i);
    assert.doesNotMatch(`${service}\n${email}`, /console\.(?:log|info|warn|error).*code/i);
    assert.match(service, /user\.role !== UserRole\.USER/);
    assert.match(routes, /setAuthCookie/);
  });

  assert.match(purchaserOtpEmailText('012345', 10), /مرة واحدة/);
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

void main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
