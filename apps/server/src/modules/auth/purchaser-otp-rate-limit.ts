import { createHash } from 'node:crypto';
import { createLoginAbuseLimiter, type LoginRateLimitDecision } from './auth-rate-limit.js';

type Bucket = {
  tokens: number;
  lastMs: number;
};

type RequestLimiterOptions = {
  networkCapacity: number;
  emailCapacity: number;
  windowMs: number;
  stateTtlMs: number;
  maxEntries: number;
  now?: () => number;
};

export type PurchaserOtpRequestLimiter = {
  consume(clientIp: string, email: string): LoginRateLimitDecision;
  reset(): void;
};

export const PURCHASER_OTP_REQUEST_NETWORK_LIMIT = 20;
export const PURCHASER_OTP_REQUEST_EMAIL_LIMIT = 5;
export const PURCHASER_OTP_REQUEST_WINDOW_MS = 60 * 60 * 1000;

function opaqueIdentifier(namespace: string, value: string): string {
  return createHash('sha256').update(`wanasatna:${namespace}:v1:${value}`, 'utf8').digest('hex');
}

export function createPurchaserOtpRequestLimiter(
  options: RequestLimiterOptions,
): PurchaserOtpRequestLimiter {
  const buckets = new Map<string, Bucket>();
  const now = options.now ?? (() => Date.now());
  const networkRefillPerMs = options.networkCapacity / options.windowMs;
  const emailRefillPerMs = options.emailCapacity / options.windowMs;

  function cleanup(currentMs: number): void {
    for (const [key, bucket] of buckets) {
      if (currentMs - bucket.lastMs >= options.stateTtlMs) {
        buckets.delete(key);
      }
    }
  }

  function makeRoom(currentMs: number): void {
    cleanup(currentMs);
    if (buckets.size < options.maxEntries) {
      return;
    }

    let oldestKey: string | undefined;
    let oldestMs = Number.POSITIVE_INFINITY;
    for (const [key, bucket] of buckets) {
      if (bucket.lastMs < oldestMs) {
        oldestKey = key;
        oldestMs = bucket.lastMs;
      }
    }
    if (oldestKey) {
      buckets.delete(oldestKey);
    }
  }

  function bucketFor(key: string, capacity: number, currentMs: number): Bucket {
    const existing = buckets.get(key);
    if (existing) {
      return existing;
    }
    makeRoom(currentMs);
    const bucket = { tokens: capacity, lastMs: currentMs };
    buckets.set(key, bucket);
    return bucket;
  }

  function refill(bucket: Bucket, capacity: number, refillPerMs: number, currentMs: number): void {
    const elapsedMs = Math.max(0, currentMs - bucket.lastMs);
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsedMs * refillPerMs);
    bucket.lastMs = currentMs;
  }

  return {
    consume(clientIp, email) {
      const currentMs = now();
      cleanup(currentMs);
      const networkBucket = bucketFor(`network:${clientIp}`, options.networkCapacity, currentMs);
      const emailBucket = bucketFor(
        `email:${opaqueIdentifier('purchaser-otp-email-limit', email)}`,
        options.emailCapacity,
        currentMs,
      );
      refill(networkBucket, options.networkCapacity, networkRefillPerMs, currentMs);
      refill(emailBucket, options.emailCapacity, emailRefillPerMs, currentMs);

      if (networkBucket.tokens >= 1 && emailBucket.tokens >= 1) {
        networkBucket.tokens -= 1;
        emailBucket.tokens -= 1;
        return { allowed: true, retryAfterSeconds: 0 };
      }

      const networkWaitMs =
        networkBucket.tokens >= 1 ? 0 : (1 - networkBucket.tokens) / networkRefillPerMs;
      const emailWaitMs = emailBucket.tokens >= 1 ? 0 : (1 - emailBucket.tokens) / emailRefillPerMs;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(Math.max(networkWaitMs, emailWaitMs) / 1000)),
      };
    },

    reset() {
      buckets.clear();
    },
  };
}

// Process-local, matching the existing auth limiter and current single Railway replica.
const requestLimiter = createPurchaserOtpRequestLimiter({
  networkCapacity: PURCHASER_OTP_REQUEST_NETWORK_LIMIT,
  emailCapacity: PURCHASER_OTP_REQUEST_EMAIL_LIMIT,
  windowMs: PURCHASER_OTP_REQUEST_WINDOW_MS,
  stateTtlMs: 2 * PURCHASER_OTP_REQUEST_WINDOW_MS,
  maxEntries: 20_000,
});

const verificationLimiter = createLoginAbuseLimiter({
  failureThreshold: 3,
  baseDelayMs: 15_000,
  maxDelayMs: 15 * 60 * 1000,
  stateTtlMs: 30 * 60 * 1000,
  maxEntries: 20_000,
});

function verificationIdentifier(challengeId: string): string {
  return opaqueIdentifier('purchaser-otp-verification-limit', challengeId);
}

export function consumePurchaserOtpRequestLimit(
  clientIp: string,
  email: string,
): LoginRateLimitDecision {
  return requestLimiter.consume(clientIp, email);
}

export function checkPurchaserOtpVerificationRateLimit(
  clientIp: string,
  challengeId: string,
): LoginRateLimitDecision {
  return verificationLimiter.check(clientIp, verificationIdentifier(challengeId));
}

export function recordPurchaserOtpVerificationFailure(clientIp: string, challengeId: string): void {
  verificationLimiter.recordFailure(clientIp, verificationIdentifier(challengeId));
}

export function recordPurchaserOtpVerificationSuccess(clientIp: string, challengeId: string): void {
  verificationLimiter.recordSuccess(clientIp, verificationIdentifier(challengeId));
}

export function resetPurchaserOtpRateLimitersForTests(): void {
  requestLimiter.reset();
  verificationLimiter.reset();
}
