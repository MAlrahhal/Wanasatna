import { UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { createAdminAuditLog } from '../admin/admin-audit.service.js';
import {
  ADMIN_TOTP_KEY_VERSION,
  assertAdminTotpEncryptionConfigured,
  decryptAdminTotpSecret,
  encryptAdminTotpSecret,
} from './admin-totp-crypto.js';
import {
  createAdminTotpEnrollment,
  generateAdminRecoveryCodes,
  hashAdminRecoveryCode,
  validateAdminTotp,
} from './admin-totp.js';

const RECOVERY_CODE_COUNT = 10;

type EnrollmentAdmin = {
  id: string;
  email: string;
  role: UserRole;
};

async function findEnrollmentAdmin(identifier: string): Promise<EnrollmentAdmin> {
  const normalized = identifier.trim();
  if (!normalized) {
    throw new Error('No matching ADMIN. MFA enrollment aborted.');
  }

  const user = normalized.includes('@')
    ? await prisma.user.findUnique({
        where: { email: normalized.toLowerCase() },
        select: { id: true, email: true, role: true },
      })
    : await prisma.user.findUnique({
        where: { id: normalized },
        select: { id: true, email: true, role: true },
      });

  if (!user || user.role !== UserRole.ADMIN) {
    throw new Error('No matching ADMIN. MFA enrollment aborted.');
  }

  return user;
}

export async function startAdminMfaEnrollment(identifier: string): Promise<{
  userId: string;
  email: string;
  secret: string;
  otpauthUri: string;
}> {
  assertAdminTotpEncryptionConfigured();
  const user = await findEnrollmentAdmin(identifier);
  const enrollment = createAdminTotpEnrollment(user.email);
  const encryptedSecret = encryptAdminTotpSecret(user.id, enrollment.secret);

  await prisma.$transaction(async (tx) => {
    const currentUser = await tx.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    const existing = await tx.adminTotpCredential.findUnique({
      where: { userId: user.id },
      select: { enabledAt: true },
    });

    if (currentUser?.role !== UserRole.ADMIN) {
      throw new Error('No matching ADMIN. MFA enrollment aborted.');
    }
    if (existing?.enabledAt) {
      throw new Error('MFA is already enabled for this ADMIN.');
    }

    await tx.adminTotpCredential.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        encryptedSecret,
        keyVersion: ADMIN_TOTP_KEY_VERSION,
      },
      update: {
        encryptedSecret,
        keyVersion: ADMIN_TOTP_KEY_VERSION,
        enabledAt: null,
        lastUsedStep: null,
      },
    });
    await tx.adminRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.adminMfaChallenge.deleteMany({ where: { userId: user.id } });
    await createAdminAuditLog(
      {
        actorUserId: null,
        action: 'MFA_ENROLLMENT_STARTED',
        targetId: user.id,
        outcome: 'SUCCESS',
        metadata: { source: 'CLI', keyVersion: ADMIN_TOTP_KEY_VERSION },
      },
      tx,
    );
  });

  return {
    userId: user.id,
    email: user.email,
    secret: enrollment.secret,
    otpauthUri: enrollment.otpauthUri,
  };
}

export async function confirmAdminMfaEnrollment(
  identifier: string,
  token: string,
  now = new Date(),
): Promise<{
  userId: string;
  email: string;
  recoveryCodes: string[];
}> {
  assertAdminTotpEncryptionConfigured();
  const user = await findEnrollmentAdmin(identifier);
  const credential = await prisma.adminTotpCredential.findUnique({
    where: { userId: user.id },
  });

  if (!credential || credential.enabledAt) {
    throw new Error('Start MFA enrollment before confirming it.');
  }
  if (credential.keyVersion !== ADMIN_TOTP_KEY_VERSION) {
    throw new Error('MFA enrollment cannot be decrypted with the configured key version.');
  }

  const secret = decryptAdminTotpSecret(user.id, credential.encryptedSecret);
  const acceptedStep = validateAdminTotp(secret, token.trim(), now.getTime());
  if (acceptedStep === null) {
    throw new Error('The TOTP code is invalid. MFA was not enabled.');
  }

  const recoveryCodes = generateAdminRecoveryCodes(RECOVERY_CODE_COUNT);
  const recoveryCodeRows = recoveryCodes.map((code) => {
    const codeHash = hashAdminRecoveryCode(user.id, code);
    if (!codeHash) {
      throw new Error('Recovery code generation failed. MFA was not enabled.');
    }
    return { userId: user.id, codeHash };
  });

  await prisma.$transaction(async (tx) => {
    const currentUser = await tx.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (currentUser?.role !== UserRole.ADMIN) {
      throw new Error('No matching ADMIN. MFA enrollment aborted.');
    }

    const enabled = await tx.adminTotpCredential.updateMany({
      where: {
        id: credential.id,
        enabledAt: null,
        updatedAt: credential.updatedAt,
        OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: acceptedStep } }],
      },
      data: {
        enabledAt: now,
        lastUsedStep: acceptedStep,
      },
    });
    if (enabled.count !== 1) {
      throw new Error('MFA enrollment changed concurrently. Start again.');
    }

    await tx.adminRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.adminRecoveryCode.createMany({ data: recoveryCodeRows });
    await tx.authSession.deleteMany({ where: { userId: user.id } });
    await tx.adminMfaChallenge.deleteMany({ where: { userId: user.id } });
    await createAdminAuditLog(
      {
        actorUserId: null,
        action: 'MFA_ENABLED',
        targetId: user.id,
        outcome: 'SUCCESS',
        metadata: {
          source: 'CLI',
          keyVersion: ADMIN_TOTP_KEY_VERSION,
          recoveryCodeCount: recoveryCodes.length,
        },
      },
      tx,
    );
  });

  return {
    userId: user.id,
    email: user.email,
    recoveryCodes,
  };
}
