import { createHash, randomBytes } from 'node:crypto';
import * as OTPAuth from 'otpauth';

const TOTP_ISSUER = 'وناستنا';
const TOTP_ALGORITHM = 'SHA1';
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW = 1;
const RECOVERY_CODE_BYTES = 10;

function createTotp(secret: string, label = 'admin'): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

export function createAdminTotpEnrollment(email: string): {
  secret: string;
  otpauthUri: string;
} {
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  return {
    secret,
    otpauthUri: createTotp(secret, email).toString(),
  };
}

export function validateAdminTotp(
  secret: string,
  token: string,
  timestamp = Date.now(),
): number | null {
  if (!/^\d{6}$/.test(token)) {
    return null;
  }

  const totp = createTotp(secret);
  const delta = totp.validate({ token, timestamp, window: TOTP_WINDOW });
  if (delta === null) {
    return null;
  }

  return totp.counter({ timestamp }) + delta;
}

export function generateAdminRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const value = randomBytes(RECOVERY_CODE_BYTES).toString('hex').toUpperCase();
    return value.match(/.{1,4}/g)?.join('-') ?? value;
  });
}

export function normalizeAdminRecoveryCode(code: string): string | null {
  const normalized = code.replace(/[\s-]/g, '').toUpperCase();
  return /^[0-9A-F]{20}$/.test(normalized) ? normalized : null;
}

export function hashAdminRecoveryCode(userId: string, code: string): string | null {
  const normalized = normalizeAdminRecoveryCode(code);
  if (!normalized) {
    return null;
  }

  return createHash('sha256')
    .update(`wanasatna:admin-recovery:v1:${userId}:${normalized}`, 'utf8')
    .digest('hex');
}

export const ADMIN_TOTP_PERIOD_SECONDS = TOTP_PERIOD_SECONDS;
export const ADMIN_TOTP_VALIDATION_WINDOW = TOTP_WINDOW;
