/**
 * Focused DB-backed admin MFA tests for pre-launch security hardening Batch 3.
 * Requires the isolated TEST_DATABASE_URL and the Batch 3 migration.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import * as OTPAuth from 'otpauth';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import {
  adminForceCloseRoom,
  adminKickPlayer,
  adminLockRoom,
} from '../src/modules/admin/admin-rooms.service.js';
import { promoteExistingUserToAdmin } from '../src/modules/admin/promote-existing-user.js';
import {
  confirmAdminMfaEnrollment,
  startAdminMfaEnrollment,
} from '../src/modules/auth/admin-mfa-enrollment.service.js';
import {
  ADMIN_MFA_CHALLENGE_MAX_ATTEMPTS,
  createAdminMfaChallenge,
  verifyAdminMfaChallenge,
} from '../src/modules/auth/admin-mfa.service.js';
import { resetAdminMfaRateLimiterForTests } from '../src/modules/auth/admin-mfa-rate-limit.js';
import {
  AdminTotpEncryptionError,
  decryptAdminTotpSecret,
  encryptAdminTotpSecret,
} from '../src/modules/auth/admin-totp-crypto.js';
import { hashAdminRecoveryCode, validateAdminTotp } from '../src/modules/auth/admin-totp.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { loginUser, registerUser, resolveAuthSession } from '../src/modules/auth/auth.service.js';
import { generateSessionToken, hashSessionToken } from '../src/modules/auth/session-token.js';
import { resolveSocketAccountUser } from '../src/modules/auth/socket-auth.js';
import { setGameEnabled } from '../src/modules/game/game-availability.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

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

function uniqueEmail(prefix: string): string {
  return `batch3.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
}

function totp(secret: string, timestamp: number): string {
  return new OTPAuth.TOTP({
    issuer: 'وناستنا',
    label: 'admin',
    secret: OTPAuth.Secret.fromBase32(secret),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  }).generate({ timestamp });
}

function wrongTotp(valid: string): string {
  return `${valid[0] === '0' ? '1' : '0'}${valid.slice(1)}`;
}

function challengeToken(result: Awaited<ReturnType<typeof loginUser>>): string {
  if (!result.success || !('mfaRequired' in result.data)) {
    throw new Error('Expected an MFA challenge.');
  }
  assert.equal(result.data.mfaRequired, true);
  assert.equal('user' in result.data, false);
  assert.equal('session' in result, false);
  return result.data.challengeToken;
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

async function main(): Promise<void> {
  await test('AES-256-GCM roundtrip is bound to user and fails closed', () => {
    const encrypted = encryptAdminTotpSecret('admin-1', 'JBSWY3DPEHPK3PXP', TEST_KEY);
    assert.equal(encrypted.startsWith('v1.'), true);
    assert.equal(encrypted.includes('JBSWY3DPEHPK3PXP'), false);
    assert.equal(decryptAdminTotpSecret('admin-1', encrypted, TEST_KEY), 'JBSWY3DPEHPK3PXP');
    assert.throws(
      () => decryptAdminTotpSecret('admin-2', encrypted, TEST_KEY),
      AdminTotpEncryptionError,
    );
    assert.throws(() => encryptAdminTotpSecret('admin-1', 'secret', ''));
    assert.throws(() => encryptAdminTotpSecret('admin-1', 'secret', 'abcd'));
  });

  await test('TOTP accepts only the narrow plus/minus one-step window', () => {
    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    const timestamp = 1_900_000_000_000;
    assert.notEqual(validateAdminTotp(secret, totp(secret, timestamp - 30_000), timestamp), null);
    assert.notEqual(validateAdminTotp(secret, totp(secret, timestamp), timestamp), null);
    assert.notEqual(validateAdminTotp(secret, totp(secret, timestamp + 30_000), timestamp), null);
    assert.equal(validateAdminTotp(secret, totp(secret, timestamp - 60_000), timestamp), null);
    assert.equal(validateAdminTotp(secret, totp(secret, timestamp + 60_000), timestamp), null);
  });

  const adminEmail = uniqueEmail('admin');
  const userEmail = uniqueEmail('user');
  let adminId = '';
  let userId = '';
  let recoveryCodes: string[] = [];
  let enrollmentSecret = '';
  let mfaSessionToken = '';
  const roomIds: string[] = [];
  const originalGameConfig = await prisma.gameAdminConfig.findUnique({
    where: { gameId: 'fast-answer' },
  });

  try {
    await test('enrollment is ADMIN-only, encrypted, confirmed, and revokes sessions', async () => {
      const registeredUser = await registerUser({
        email: userEmail,
        password: 'password-ok',
        preferredDisplayName: 'مستخدم',
      });
      assert.equal(registeredUser.success, true);
      if (!registeredUser.success) {
        throw new Error('USER registration failed.');
      }
      userId = registeredUser.data.user.id;
      await assert.rejects(() => startAdminMfaEnrollment(userEmail), /No matching ADMIN/);

      const registeredAdmin = await registerUser({
        email: adminEmail,
        password: 'password-ok',
        preferredDisplayName: 'مدير',
      });
      assert.equal(registeredAdmin.success, true);
      if (!registeredAdmin.success) {
        throw new Error('ADMIN registration failed.');
      }
      adminId = registeredAdmin.data.user.id;
      await promoteExistingUserToAdmin(adminId);

      const preEnrollmentLogin = await loginUser({ email: adminEmail, password: 'password-ok' });
      assert.equal(preEnrollmentLogin.success, true);
      assert.equal(await prisma.authSession.count({ where: { userId: adminId } }), 1);

      const enrollment = await startAdminMfaEnrollment(adminId);
      enrollmentSecret = enrollment.secret;
      const stored = await prisma.adminTotpCredential.findUnique({ where: { userId: adminId } });
      assert.ok(stored);
      assert.equal(stored?.enabledAt, null);
      assert.equal(stored?.encryptedSecret.includes(enrollmentSecret), false);
      assert.equal(decryptAdminTotpSecret(adminId, stored!.encryptedSecret), enrollmentSecret);

      const confirmationTime = new Date();
      const confirmed = await confirmAdminMfaEnrollment(
        adminId,
        totp(enrollmentSecret, confirmationTime.getTime()),
        confirmationTime,
      );
      recoveryCodes = confirmed.recoveryCodes;
      assert.equal(recoveryCodes.length, 10);
      assert.equal(await prisma.authSession.count({ where: { userId: adminId } }), 0);
      assert.equal(await prisma.adminMfaChallenge.count({ where: { userId: adminId } }), 0);

      const enabled = await prisma.adminTotpCredential.findUnique({ where: { userId: adminId } });
      assert.ok(enabled?.enabledAt);
      assert.notEqual(enabled?.lastUsedStep, null);
      const storedCodes = await prisma.adminRecoveryCode.findMany({ where: { userId: adminId } });
      assert.equal(storedCodes.length, 10);
      for (const code of recoveryCodes) {
        const expectedHash = hashAdminRecoveryCode(adminId, code);
        assert.ok(expectedHash);
        assert.equal(
          storedCodes.some((row) => row.codeHash === expectedHash),
          true,
        );
        assert.equal(
          storedCodes.some((row) => row.codeHash.includes(code)),
          false,
        );
      }
    });

    await test('password-only ADMIN login creates only a hashed short-lived challenge', async () => {
      const beforeSessions = await prisma.authSession.count({ where: { userId: adminId } });
      const token = challengeToken(await loginUser({ email: adminEmail, password: 'password-ok' }));
      const challenge = await prisma.adminMfaChallenge.findUnique({
        where: { tokenHash: hashSessionToken(token) },
      });
      assert.ok(challenge);
      assert.notEqual(challenge?.tokenHash, token);
      assert.equal(challenge?.attempts, 0);
      assert.equal(await prisma.authSession.count({ where: { userId: adminId } }), beforeSessions);
    });

    await test('correct TOTP issues an MFA session; replay is rejected', async () => {
      const token = challengeToken(await loginUser({ email: adminEmail, password: 'password-ok' }));
      const timestamp = Date.now() + 30_000;
      const code = totp(enrollmentSecret, timestamp);
      const verified = await verifyAdminMfaChallenge(
        { challengeToken: token, method: 'totp', code },
        new Date(timestamp),
        'batch3-totp-success',
      );
      assert.equal(verified.success, true);
      if (!verified.success) {
        throw new Error('TOTP verification failed.');
      }
      mfaSessionToken = verified.session.sessionToken;
      const storedSession = await prisma.authSession.findUnique({
        where: { tokenHash: hashSessionToken(mfaSessionToken) },
      });
      assert.ok(storedSession?.mfaVerifiedAt);
      assert.equal(
        (await resolveAuthSession(mfaSessionToken, { requireAdminMfa: true }))?.id,
        adminId,
      );

      const replayToken = challengeToken(
        await loginUser({ email: adminEmail, password: 'password-ok' }),
      );
      const replay = await verifyAdminMfaChallenge(
        { challengeToken: replayToken, method: 'totp', code },
        new Date(timestamp),
      );
      assert.equal(replay.success, false);
    });

    await test('wrong, expired, and attempt-exhausted challenges stay generic', async () => {
      const token = challengeToken(await loginUser({ email: adminEmail, password: 'password-ok' }));
      const timestamp = Date.now() + 60_000;
      const valid = totp(enrollmentSecret, timestamp);
      const invalid = wrongTotp(valid);

      for (let attempt = 0; attempt < ADMIN_MFA_CHALLENGE_MAX_ATTEMPTS; attempt += 1) {
        const result = await verifyAdminMfaChallenge(
          { challengeToken: token, method: 'totp', code: invalid },
          new Date(timestamp),
        );
        assert.equal(result.success, false);
        if (!result.success) {
          assert.equal(result.error.code, 'INVALID_CREDENTIALS');
        }
      }
      const exhausted = await verifyAdminMfaChallenge(
        { challengeToken: token, method: 'totp', code: valid },
        new Date(timestamp),
      );
      assert.equal(exhausted.success, false);
      const stored = await prisma.adminMfaChallenge.findUnique({
        where: { tokenHash: hashSessionToken(token) },
      });
      assert.equal(stored?.attempts, ADMIN_MFA_CHALLENGE_MAX_ATTEMPTS);

      const old = new Date(Date.now() - 10 * 60 * 1000);
      const expiredToken = await createAdminMfaChallenge(adminId, old);
      const expired = await verifyAdminMfaChallenge(
        { challengeToken: expiredToken, method: 'totp', code: valid },
        new Date(),
      );
      assert.equal(expired.success, false);
      assert.equal(
        await prisma.adminMfaChallenge.count({
          where: { tokenHash: hashSessionToken(expiredToken) },
        }),
        0,
      );
    });

    await test('a recovery code works once and revokes other sessions', async () => {
      const token = challengeToken(await loginUser({ email: adminEmail, password: 'password-ok' }));
      const recovered = await verifyAdminMfaChallenge({
        challengeToken: token,
        method: 'recovery',
        code: recoveryCodes[0]!,
      });
      assert.equal(recovered.success, true);
      if (!recovered.success) {
        throw new Error('Recovery verification failed.');
      }
      assert.equal(await resolveAuthSession(mfaSessionToken), null);
      mfaSessionToken = recovered.session.sessionToken;

      const reuseToken = challengeToken(
        await loginUser({ email: adminEmail, password: 'password-ok' }),
      );
      const reused = await verifyAdminMfaChallenge({
        challengeToken: reuseToken,
        method: 'recovery',
        code: recoveryCodes[0]!,
      });
      assert.equal(reused.success, false);
    });

    await test('HTTP MFA sets the cookie and recovery attempts are rate limited by user', async () => {
      resetAdminMfaRateLimiterForTests();
      await withApp(async (baseUrl) => {
        const login = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: adminEmail, password: 'password-ok' }),
        });
        assert.equal(login.status, 202);
        const loginBody = (await login.json()) as {
          data: { mfaRequired: true; challengeToken: string };
        };

        const verified = await fetch(`${baseUrl}/api/auth/mfa/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            challengeToken: loginBody.data.challengeToken,
            method: 'recovery',
            code: recoveryCodes[1],
          }),
        });
        assert.equal(verified.status, 200);
        const setCookie = verified.headers.get('set-cookie') ?? '';
        assert.match(setCookie, new RegExp(`^${AUTH_COOKIE_NAME}=`));
        assert.doesNotMatch(setCookie, /Max-Age=0(?:;|$)/);
        const encodedToken = setCookie.match(new RegExp(`^${AUTH_COOKIE_NAME}=([^;]+)`))?.[1];
        assert.ok(encodedToken);
        mfaSessionToken = decodeURIComponent(encodedToken!);

        const adminMe = await fetch(`${baseUrl}/api/admin/me`, {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(mfaSessionToken)}` },
        });
        assert.equal(adminMe.status, 200);

        const limitedLogin = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: adminEmail, password: 'password-ok' }),
        });
        const limitedLoginBody = (await limitedLogin.json()) as {
          data: { challengeToken: string };
        };
        const limitedToken = limitedLoginBody.data.challengeToken;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const rejected = await fetch(`${baseUrl}/api/auth/mfa/verify`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              challengeToken: limitedToken,
              method: 'recovery',
              code: 'FFFF-FFFF-FFFF-FFFF-FFFF',
            }),
          });
          assert.equal(rejected.status, 401);
        }

        const blocked = await fetch(`${baseUrl}/api/auth/mfa/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            challengeToken: limitedToken,
            method: 'recovery',
            code: 'FFFF-FFFF-FFFF-FFFF-FFFF',
          }),
        });
        assert.equal(blocked.status, 429);
        assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
        const rateLimitAudits = await prisma.adminAuditLog.findMany({
          where: { targetId: adminId, action: 'MFA_LOGIN_FAILURE' },
          select: { metadata: true },
        });
        assert.equal(
          rateLimitAudits.some(
            (entry) => (entry.metadata as { reason?: unknown } | null)?.reason === 'RATE_LIMITED',
          ),
          true,
        );

        const replacementLogin = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: adminEmail, password: 'password-ok' }),
        });
        const replacementBody = (await replacementLogin.json()) as {
          data: { challengeToken: string };
        };
        const stillBlocked = await fetch(`${baseUrl}/api/auth/mfa/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            challengeToken: replacementBody.data.challengeToken,
            method: 'totp',
            code: '000000',
          }),
        });
        assert.equal(stillBlocked.status, 429);
      });
      resetAdminMfaRateLimiterForTests();
    });

    await test('MFA-enabled ADMIN cannot use a non-MFA session on admin endpoints', async () => {
      const rawToken = generateSessionToken();
      await prisma.authSession.create({
        data: {
          userId: adminId,
          tokenHash: hashSessionToken(rawToken),
          expiresAt: new Date(Date.now() + 60_000),
          mfaVerifiedAt: null,
        },
      });
      assert.equal((await resolveAuthSession(rawToken))?.id, adminId);
      assert.equal(await resolveAuthSession(rawToken, { requireAdminMfa: true }), null);
      const socket = {
        handshake: { headers: { cookie: `${AUTH_COOKIE_NAME}=${rawToken}` } },
        data: {},
      } as Parameters<typeof resolveSocketAccountUser>[0];
      assert.equal(await resolveSocketAccountUser(socket), null);

      await withApp(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/admin/me`, {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${rawToken}` },
        });
        assert.equal(response.status, 401);
      });
    });

    await test('USER login remains password-only', async () => {
      const result = await loginUser({ email: userEmail, password: 'password-ok' });
      assert.equal(result.success, true);
      if (!result.success || !('session' in result)) {
        throw new Error('USER login did not issue a session.');
      }
      assert.equal(result.data.user.role, 'USER');
      assert.equal((await resolveAuthSession(result.session.sessionToken))?.id, userId);
    });

    await test('privileged operations append safe audit records and audit API is protected', async () => {
      await setGameEnabled('fast-answer', false, {
        actorUserId: adminId,
        requestId: 'batch3-game',
      });

      const room = await createRoom({ playerName: `مدير${Date.now() % 10_000}` }, adminId);
      assert.equal(room.success, true);
      if (!room.success) {
        throw new Error('Room creation failed.');
      }
      roomIds.push(room.data.room.id);
      assert.equal(
        (await adminLockRoom(room.data.room.id, 'missing-audit-actor', true)).success,
        true,
      );
      assert.equal(
        (await prisma.room.findUnique({ where: { id: room.data.room.id } }))?.isLocked,
        true,
      );
      assert.equal((await adminLockRoom(room.data.room.id, adminId, false)).success, true);
      assert.equal((await adminLockRoom(room.data.room.id, adminId, true)).success, true);
      assert.equal((await adminForceCloseRoom(room.data.room.id, adminId)).success, true);

      const kickRoom = await createRoom({ playerName: `مضيف${Date.now() % 10_000}` }, adminId);
      assert.equal(kickRoom.success, true);
      if (!kickRoom.success) {
        throw new Error('Kick room creation failed.');
      }
      roomIds.push(kickRoom.data.room.id);
      assert.equal(
        (await adminKickPlayer(kickRoom.data.room.id, kickRoom.data.player.id, adminId)).success,
        true,
      );

      const actions = await prisma.adminAuditLog.findMany({
        where: {
          OR: [{ targetId: adminId }, { requestId: 'batch3-game' }, { targetId: { in: roomIds } }],
        },
        select: {
          action: true,
          actorUserId: true,
          targetId: true,
          outcome: true,
          requestId: true,
          metadata: true,
        },
      });
      for (const expected of [
        'ROLE_PROMOTED',
        'MFA_ENROLLMENT_STARTED',
        'MFA_ENABLED',
        'MFA_LOGIN_SUCCESS',
        'MFA_LOGIN_FAILURE',
        'MFA_RECOVERY_USED',
        'GAME_AVAILABILITY_SET',
        'ROOM_LOCK',
        'ROOM_UNLOCK',
        'ROOM_KICK',
        'ROOM_FORCE_CLOSE',
      ]) {
        assert.equal(
          actions.some((entry) => entry.action === expected),
          true,
          expected,
        );
      }
      const gameAudit = actions.find(
        (entry) => entry.action === 'GAME_AVAILABILITY_SET' && entry.requestId === 'batch3-game',
      );
      assert.deepEqual(
        gameAudit && {
          actorUserId: gameAudit.actorUserId,
          targetId: gameAudit.targetId,
          outcome: gameAudit.outcome,
        },
        { actorUserId: adminId, targetId: 'fast-answer', outcome: 'SUCCESS' },
      );
      for (const action of ['ROOM_LOCK', 'ROOM_UNLOCK', 'ROOM_KICK', 'ROOM_FORCE_CLOSE']) {
        const row = actions.find((entry) => entry.action === action);
        assert.equal(row?.actorUserId, adminId);
        assert.equal(row?.outcome, 'SUCCESS');
        assert.equal(roomIds.includes(row?.targetId ?? ''), true);
      }
      for (const entry of actions) {
        for (const key of Object.keys((entry.metadata as Record<string, unknown> | null) ?? {})) {
          assert.doesNotMatch(
            key,
            /password|totpCode|secret|^recoveryCode$|cookie|session.*token|reconnect|authorization|raw.*ip|body/i,
          );
        }
      }

      const userSession = await loginUser({ email: userEmail, password: 'password-ok' });
      if (!userSession.success || !('session' in userSession)) {
        throw new Error('USER session missing.');
      }
      await withApp(async (baseUrl) => {
        const guest = await fetch(`${baseUrl}/api/admin/audit`);
        assert.equal(guest.status, 401);
        const user = await fetch(`${baseUrl}/api/admin/audit`, {
          headers: {
            cookie: `${AUTH_COOKIE_NAME}=${userSession.session.sessionToken}`,
          },
        });
        assert.equal(user.status, 403);
        const admin = await fetch(`${baseUrl}/api/admin/audit`, {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${mfaSessionToken}` },
        });
        assert.equal(admin.status, 200);
        const body = (await admin.json()) as { data: { entries: unknown[]; pageSize: number } };
        assert.equal(body.data.pageSize, 50);
        assert.equal(Array.isArray(body.data.entries), true);
      });
    });
  } finally {
    for (const roomId of roomIds) {
      await prisma.productEvent.deleteMany({ where: { roomId } }).catch(() => undefined);
      await prisma.room.deleteMany({ where: { id: roomId } }).catch(() => undefined);
    }
    if (originalGameConfig) {
      await prisma.gameAdminConfig
        .upsert({
          where: { gameId: originalGameConfig.gameId },
          create: {
            gameId: originalGameConfig.gameId,
            isEnabled: originalGameConfig.isEnabled,
          },
          update: { isEnabled: originalGameConfig.isEnabled },
        })
        .catch(() => undefined);
    } else {
      await prisma.gameAdminConfig
        .deleteMany({ where: { gameId: 'fast-answer' } })
        .catch(() => undefined);
    }
    await prisma.adminAuditLog
      .deleteMany({
        where: {
          OR: [
            { targetId: adminId || '__none__' },
            { requestId: 'batch3-game' },
            { targetId: { in: roomIds.length > 0 ? roomIds : ['__none__'] } },
          ],
        },
      })
      .catch(() => undefined);
    if (adminId) {
      await prisma.user.deleteMany({ where: { id: adminId } }).catch(() => undefined);
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect().catch(() => undefined);
  }

  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
