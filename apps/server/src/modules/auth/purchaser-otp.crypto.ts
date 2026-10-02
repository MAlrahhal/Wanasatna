import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const PURCHASER_OTP_CODE_DIGITS = 6;

export function isPurchaserOtpSecretConfigured(secret: string | undefined): secret is string {
  return Boolean(secret && secret.trim().length >= 32);
}

export function generatePurchaserOtpCode(): string {
  return randomInt(0, 10 ** PURCHASER_OTP_CODE_DIGITS)
    .toString()
    .padStart(PURCHASER_OTP_CODE_DIGITS, '0');
}

export function hashPurchaserOtpCode(
  secret: string,
  challengeId: string,
  email: string,
  code: string,
): string {
  return createHmac('sha256', secret)
    .update(`wanasatna:purchaser-otp:v1\0${challengeId}\0${email}\0${code}`, 'utf8')
    .digest('hex');
}

export function purchaserOtpHashMatches(candidateHash: string, storedHash: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(candidateHash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}
