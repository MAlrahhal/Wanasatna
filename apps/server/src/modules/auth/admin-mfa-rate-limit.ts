import { createHash } from 'node:crypto';
import { createLoginAbuseLimiter, type LoginRateLimitDecision } from './auth-rate-limit.js';

const mfaLimiter = createLoginAbuseLimiter({
  failureThreshold: 3,
  baseDelayMs: 10_000,
  maxDelayMs: 5 * 60 * 1000,
  stateTtlMs: 15 * 60 * 1000,
  maxEntries: 5_000,
});
const auditedRateLimits = new Map<string, number>();
const RATE_LIMIT_AUDIT_TTL_MS = 15 * 60 * 1000;
const MAX_RATE_LIMIT_AUDIT_ENTRIES = 5_000;

function mfaIdentifier(challengeToken: string, userId?: string | null): string {
  const value = userId ? `user:${userId}` : `challenge:${challengeToken}`;
  return createHash('sha256').update(`wanasatna:admin-mfa-limit:v1:${value}`, 'utf8').digest('hex');
}

export function checkAdminMfaRateLimit(
  clientIp: string,
  challengeToken: string,
  userId?: string | null,
): LoginRateLimitDecision {
  return mfaLimiter.check(clientIp, mfaIdentifier(challengeToken, userId));
}

export function recordAdminMfaFailure(
  clientIp: string,
  challengeToken: string,
  userId?: string | null,
): void {
  mfaLimiter.recordFailure(clientIp, mfaIdentifier(challengeToken, userId));
}

export function recordAdminMfaSuccess(
  clientIp: string,
  challengeToken: string,
  userId?: string | null,
): void {
  mfaLimiter.recordSuccess(clientIp, mfaIdentifier(challengeToken, userId));
}

export function shouldAuditAdminMfaRateLimit(userId: string, now = Date.now()): boolean {
  for (const [key, expiresAt] of auditedRateLimits) {
    if (expiresAt <= now) {
      auditedRateLimits.delete(key);
    }
  }

  const key = mfaIdentifier('', userId);
  if ((auditedRateLimits.get(key) ?? 0) > now) {
    return false;
  }
  if (auditedRateLimits.size >= MAX_RATE_LIMIT_AUDIT_ENTRIES) {
    const oldestKey = auditedRateLimits.keys().next().value as string | undefined;
    if (oldestKey) {
      auditedRateLimits.delete(oldestKey);
    }
  }
  auditedRateLimits.set(key, now + RATE_LIMIT_AUDIT_TTL_MS);
  return true;
}

export function resetAdminMfaRateLimiterForTests(): void {
  mfaLimiter.reset();
  auditedRateLimits.clear();
}
