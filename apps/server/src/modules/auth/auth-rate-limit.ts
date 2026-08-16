type TokenPolicy = {
  capacity: number;
  refillPerSecond: number;
};

type Bucket = {
  tokens: number;
  lastMs: number;
};

const POLICIES: Record<'login' | 'register', TokenPolicy> = {
  login: { capacity: 10, refillPerSecond: 10 / 60 },
  register: { capacity: 5, refillPerSecond: 5 / 60 },
};

const buckets = new Map<string, Bucket>();
let nowFn = (): number => Date.now();

export function resetAuthRateLimiterForTests(): void {
  buckets.clear();
  nowFn = () => Date.now();
}

export function consumeAuthRateLimit(ip: string, action: 'login' | 'register'): boolean {
  const policy = POLICIES[action];
  const key = `${action}:${ip}`;
  const now = nowFn();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: policy.capacity, lastMs: now };
    buckets.set(key, bucket);
  }

  const elapsedSec = Math.max(0, now - bucket.lastMs) / 1000;
  bucket.tokens = Math.min(policy.capacity, bucket.tokens + elapsedSec * policy.refillPerSecond);
  bucket.lastMs = now;

  if (bucket.tokens < 1) {
    return false;
  }

  bucket.tokens -= 1;
  return true;
}
