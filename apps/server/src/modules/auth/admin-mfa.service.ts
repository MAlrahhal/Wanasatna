import { UserRole } from '@prisma/client';
import type { AuthActionResponse, AuthSessionData } from '@wanasatna/shared';
import { prisma } from '../../lib/prisma.js';
import {
  createAdminAuditLog,
  createAdminAuditLogBestEffort,
} from '../admin/admin-audit.service.js';
import {
  ADMIN_TOTP_KEY_VERSION,
  assertAdminTotpEncryptionConfigured,
  decryptAdminTotpSecret,
} from './admin-totp-crypto.js';
import { hashAdminRecoveryCode, validateAdminTotp } from './admin-totp.js';
import type { AdminMfaVerificationInput } from './auth.validators.js';
import { issueAuthSession, type IssuedAuthSession } from './issue-auth-session.js';
import { generateSessionToken, hashSessionToken } from './session-token.js';

export const ADMIN_MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const ADMIN_MFA_CHALLENGE_MAX_ATTEMPTS = 5;

const INVALID_MFA_MESSAGE = 'تعذر التحقق من رمز الأمان.';

type AdminMfaVerificationResult =
  | {
      success: true;
      data: AuthSessionData;
      session: IssuedAuthSession;
    }
  | Extract<AuthActionResponse<never>, { success: false }>;

type VerificationTransactionResult = { ok: true; session: IssuedAuthSession } | { ok: false };

function invalidMfa(): Extract<AuthActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: {
      code: 'INVALID_CREDENTIALS',
      message: INVALID_MFA_MESSAGE,
    },
  };
}

function methodMetadata(method: AdminMfaVerificationInput['method']): 'TOTP' | 'RECOVERY_CODE' {
  return method === 'recovery' ? 'RECOVERY_CODE' : 'TOTP';
}

export async function cleanupExpiredAdminMfaChallenges(now = new Date()): Promise<number> {
  const result = await prisma.adminMfaChallenge.deleteMany({
    where: { expiresAt: { lte: now } },
  });
  return result.count;
}

export async function resolveAdminMfaChallengeUserId(
  challengeToken: string,
): Promise<string | null> {
  const challenge = await prisma.adminMfaChallenge.findUnique({
    where: { tokenHash: hashSessionToken(challengeToken) },
    select: { userId: true },
  });
  return challenge?.userId ?? null;
}

export async function auditAdminMfaRateLimit(
  userId: string,
  method: AdminMfaVerificationInput['method'],
  requestId?: string,
): Promise<void> {
  await createAdminAuditLogBestEffort({
    actorUserId: userId,
    action: 'MFA_LOGIN_FAILURE',
    targetId: userId,
    outcome: 'FAILURE',
    requestId,
    metadata: { method: methodMetadata(method), reason: 'RATE_LIMITED' },
  });
}

export async function createAdminMfaChallenge(userId: string, now = new Date()): Promise<string> {
  assertAdminTotpEncryptionConfigured();
  const challengeToken = generateSessionToken();
  const expiresAt = new Date(now.getTime() + ADMIN_MFA_CHALLENGE_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.adminMfaChallenge.deleteMany({
      where: {
        OR: [{ userId }, { expiresAt: { lte: now } }],
      },
    });
    await tx.adminMfaChallenge.create({
      data: {
        userId,
        tokenHash: hashSessionToken(challengeToken),
        expiresAt,
      },
    });
  });

  return challengeToken;
}

export async function verifyAdminMfaChallenge(
  input: AdminMfaVerificationInput,
  now = new Date(),
  requestId?: string,
): Promise<AdminMfaVerificationResult> {
  assertAdminTotpEncryptionConfigured();
  const tokenHash = hashSessionToken(input.challengeToken);

  const result = await prisma.$transaction<VerificationTransactionResult>(async (tx) => {
    const reservation = await tx.adminMfaChallenge.updateMany({
      where: {
        tokenHash,
        expiresAt: { gt: now },
        attempts: { lt: ADMIN_MFA_CHALLENGE_MAX_ATTEMPTS },
      },
      data: { attempts: { increment: 1 } },
    });

    if (reservation.count !== 1) {
      const blockedChallenge = await tx.adminMfaChallenge.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, expiresAt: true, attempts: true },
      });
      if (blockedChallenge) {
        const reason =
          blockedChallenge.expiresAt <= now
            ? 'EXPIRED'
            : blockedChallenge.attempts >= ADMIN_MFA_CHALLENGE_MAX_ATTEMPTS
              ? 'ATTEMPT_LIMIT'
              : 'INVALID';
        await createAdminAuditLog(
          {
            actorUserId: blockedChallenge.userId,
            action: 'MFA_LOGIN_FAILURE',
            targetId: blockedChallenge.userId,
            outcome: 'FAILURE',
            requestId,
            metadata: { method: methodMetadata(input.method), reason },
          },
          tx,
        );
        if (reason === 'EXPIRED') {
          await tx.adminMfaChallenge.delete({ where: { id: blockedChallenge.id } });
        }
      }
      return { ok: false };
    }

    const challenge = await tx.adminMfaChallenge.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: { adminTotpCredential: true },
        },
      },
    });

    const credential = challenge?.user.adminTotpCredential;
    if (
      !challenge ||
      challenge.user.role !== UserRole.ADMIN ||
      !credential?.enabledAt ||
      credential.keyVersion !== ADMIN_TOTP_KEY_VERSION
    ) {
      if (challenge) {
        await createAdminAuditLog(
          {
            actorUserId: challenge.userId,
            action: 'MFA_LOGIN_FAILURE',
            targetId: challenge.userId,
            outcome: 'FAILURE',
            requestId,
            metadata: { method: methodMetadata(input.method), reason: 'MFA_NOT_ENABLED' },
          },
          tx,
        );
      }
      return { ok: false };
    }

    if (input.method === 'totp') {
      const secret = decryptAdminTotpSecret(challenge.userId, credential.encryptedSecret);
      const acceptedStep = validateAdminTotp(secret, input.code, now.getTime());

      if (acceptedStep === null) {
        await createAdminAuditLog(
          {
            actorUserId: challenge.userId,
            action: 'MFA_LOGIN_FAILURE',
            targetId: challenge.userId,
            outcome: 'FAILURE',
            requestId,
            metadata: { method: 'TOTP', reason: 'INVALID_CODE' },
          },
          tx,
        );
        return { ok: false };
      }

      const consumedStep = await tx.adminTotpCredential.updateMany({
        where: {
          id: credential.id,
          enabledAt: { not: null },
          OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: acceptedStep } }],
        },
        data: { lastUsedStep: acceptedStep },
      });

      if (consumedStep.count !== 1) {
        await createAdminAuditLog(
          {
            actorUserId: challenge.userId,
            action: 'MFA_LOGIN_FAILURE',
            targetId: challenge.userId,
            outcome: 'FAILURE',
            requestId,
            metadata: { method: 'TOTP', reason: 'REPLAYED_CODE' },
          },
          tx,
        );
        return { ok: false };
      }
    } else {
      const codeHash = hashAdminRecoveryCode(challenge.userId, input.code);
      const consumedCode = codeHash
        ? await tx.adminRecoveryCode.updateMany({
            where: {
              userId: challenge.userId,
              codeHash,
              usedAt: null,
            },
            data: { usedAt: now },
          })
        : { count: 0 };

      if (consumedCode.count !== 1) {
        await createAdminAuditLog(
          {
            actorUserId: challenge.userId,
            action: 'MFA_LOGIN_FAILURE',
            targetId: challenge.userId,
            outcome: 'FAILURE',
            requestId,
            metadata: { method: 'RECOVERY_CODE', reason: 'INVALID_CODE' },
          },
          tx,
        );
        return { ok: false };
      }

      await createAdminAuditLog(
        {
          actorUserId: challenge.userId,
          action: 'MFA_RECOVERY_USED',
          targetId: challenge.userId,
          outcome: 'SUCCESS',
          requestId,
          metadata: { method: 'RECOVERY_CODE' },
        },
        tx,
      );
      await tx.authSession.deleteMany({ where: { userId: challenge.userId } });
    }

    await tx.adminMfaChallenge.deleteMany({ where: { userId: challenge.userId } });
    const session = await issueAuthSession(challenge.user, {
      client: tx,
      mfaVerifiedAt: now,
      now,
    });

    await createAdminAuditLog(
      {
        actorUserId: challenge.userId,
        action: 'MFA_LOGIN_SUCCESS',
        targetId: challenge.userId,
        outcome: 'SUCCESS',
        requestId,
        metadata: { method: methodMetadata(input.method) },
      },
      tx,
    );

    return { ok: true, session };
  });

  if (!result.ok) {
    return invalidMfa();
  }

  return {
    success: true,
    data: { user: result.session.user },
    session: result.session,
  };
}
