type TokenPolicy = {
  capacity: number;
  refillPerSecond: number;
};

type Bucket = {
  tokens: number;
  lastMs: number;
};

type LoginFailureState = {
  failures: number;
  blockedUntilMs: number;
  expiresAtMs: number;
  lastFailureMs: number;
};

export type LoginRateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export type LoginAbuseLimiterOptions = {
  failureThreshold: number;
  baseDelayMs: number;
  maxDelayMs: number;
  stateTtlMs: number;
  maxEntries: number;
  now?: () => number;
};

export type LoginAbuseLimiter = {
  check(ip: string, identifier: string | null): LoginRateLimitDecision;
  recordFailure(ip: string, identifier: string | null): void;
  recordSuccess(ip: string, identifier: string | null): void;
  cleanupExpired(): void;
  size(): number;
  reset(): void;
};

const POLICIES: Record<'register', TokenPolicy> = {
  register: { capacity: 5, refillPerSecond: 5 / 60 },
};

const REGISTER_BUCKET_TTL_MS = 15 * 60 * 1000;
const MAX_REGISTER_BUCKETS = 2_000;
const buckets = new Map<string, Bucket>();
let nowFn = (): number => Date.now();

function cleanupRegistrationBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastMs >= REGISTER_BUCKET_TTL_MS) {
      buckets.delete(key);
    }
  }
}

function makeRegistrationBucketRoom(): void {
  if (buckets.size < MAX_REGISTER_BUCKETS) {
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

function limiterKey(kind: 'ip' | 'identifier', value: string): string {
  return `${kind}:${value}`;
}

export function normalizeLoginIdentifier(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const email = (payload as { email?: unknown }).email;
  if (typeof email !== 'string') {
    return null;
  }

  const normalized = email.trim().toLowerCase();
  if (
    normalized.length < 3 ||
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

export function createLoginAbuseLimiter(options: LoginAbuseLimiterOptions): LoginAbuseLimiter {
  const states = new Map<string, LoginFailureState>();
  const now = options.now ?? (() => Date.now());

  function cleanupExpiredAt(currentMs: number): void {
    for (const [key, state] of states) {
      if (state.expiresAtMs <= currentMs) {
        states.delete(key);
      }
    }
  }

  function makeStateRoom(currentMs: number): void {
    cleanupExpiredAt(currentMs);
    if (states.size < options.maxEntries) {
      return;
    }

    let oldestKey: string | undefined;
    let oldestMs = Number.POSITIVE_INFINITY;
    for (const [key, state] of states) {
      if (state.lastFailureMs < oldestMs) {
        oldestKey = key;
        oldestMs = state.lastFailureMs;
      }
    }
    if (oldestKey) {
      states.delete(oldestKey);
    }
  }

  function getOrCreateState(key: string, currentMs: number): LoginFailureState {
    const existing = states.get(key);
    if (existing) {
      return existing;
    }

    makeStateRoom(currentMs);
    const state: LoginFailureState = {
      failures: 0,
      blockedUntilMs: 0,
      expiresAtMs: currentMs + options.stateTtlMs,
      lastFailureMs: currentMs,
    };
    states.set(key, state);
    return state;
  }

  function keysFor(ip: string, identifier: string | null): string[] {
    const keys = [limiterKey('ip', ip)];
    if (identifier) {
      keys.push(limiterKey('identifier', identifier));
    }
    return keys;
  }

  return {
    check(ip, identifier) {
      const currentMs = now();
      cleanupExpiredAt(currentMs);
      let blockedUntilMs = 0;

      for (const key of keysFor(ip, identifier)) {
        blockedUntilMs = Math.max(blockedUntilMs, states.get(key)?.blockedUntilMs ?? 0);
      }

      if (blockedUntilMs <= currentMs) {
        return { allowed: true, retryAfterSeconds: 0 };
      }

      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((blockedUntilMs - currentMs) / 1000)),
      };
    },

    recordFailure(ip, identifier) {
      const currentMs = now();
      cleanupExpiredAt(currentMs);

      for (const key of keysFor(ip, identifier)) {
        const state = getOrCreateState(key, currentMs);
        state.failures += 1;
        state.lastFailureMs = currentMs;
        state.expiresAtMs = currentMs + options.stateTtlMs;

        if (state.failures >= options.failureThreshold) {
          const exponent = Math.min(30, state.failures - options.failureThreshold);
          const delayMs = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** exponent);
          state.blockedUntilMs = Math.max(state.blockedUntilMs, currentMs + delayMs);
        }
      }
    },

    recordSuccess(ip, identifier) {
      for (const key of keysFor(ip, identifier)) {
        states.delete(key);
      }
    },

    cleanupExpired() {
      cleanupExpiredAt(now());
    },

    size() {
      return states.size;
    },

    reset() {
      states.clear();
    },
  };
}

// Process-local by design for the current single Railway replica. Move this
// state to a shared store before horizontally scaling the auth service.
const loginLimiter = createLoginAbuseLimiter({
  failureThreshold: 5,
  baseDelayMs: 5_000,
  maxDelayMs: 15 * 60 * 1000,
  stateTtlMs: 30 * 60 * 1000,
  maxEntries: 10_000,
});

export function checkLoginRateLimit(ip: string, identifier: string | null): LoginRateLimitDecision {
  return loginLimiter.check(ip, identifier);
}

export function recordLoginFailure(ip: string, identifier: string | null): void {
  loginLimiter.recordFailure(ip, identifier);
}

export function recordLoginSuccess(ip: string, identifier: string | null): void {
  loginLimiter.recordSuccess(ip, identifier);
}

export function resetAuthRateLimiterForTests(): void {
  buckets.clear();
  loginLimiter.reset();
  nowFn = () => Date.now();
}

export function consumeAuthRateLimit(ip: string, action: 'register'): boolean {
  const policy = POLICIES[action];
  const key = `${action}:${ip}`;
  const currentMs = nowFn();
  cleanupRegistrationBuckets(currentMs);
  let bucket = buckets.get(key);

  if (!bucket) {
    makeRegistrationBucketRoom();
    bucket = { tokens: policy.capacity, lastMs: currentMs };
    buckets.set(key, bucket);
  }

  const elapsedSec = Math.max(0, currentMs - bucket.lastMs) / 1000;
  bucket.tokens = Math.min(policy.capacity, bucket.tokens + elapsedSec * policy.refillPerSecond);
  bucket.lastMs = currentMs;

  if (bucket.tokens < 1) {
    return false;
  }

  bucket.tokens -= 1;
  return true;
}
