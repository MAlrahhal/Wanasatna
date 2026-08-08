import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTE_LENGTH = 32;

export function generateReconnectToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString('base64url');
}

export function hashReconnectToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyReconnectToken(token: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) {
    return false;
  }

  const candidateHash = hashReconnectToken(token);

  try {
    return timingSafeEqual(Buffer.from(candidateHash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}
