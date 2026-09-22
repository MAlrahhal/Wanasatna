type Bucket = {
  tokens: number;
  lastMs: number;
};

const CAPACITY = 3;
const REFILL_PER_SECOND = 1 / (5 * 60);
const BUCKET_TTL_MS = 30 * 60 * 1000;
const MAX_BUCKETS = 10_000;

const buckets = new Map<string, Bucket>();
let nowFn = (): number => Date.now();

function cleanup(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastMs >= BUCKET_TTL_MS) {
      buckets.delete(key);
    }
  }
}

function makeRoom(): void {
  if (buckets.size < MAX_BUCKETS) {
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

// Process-local, matching the existing HTTP auth limiter. Move both to a
// shared store before running multiple API replicas.
export function consumeFeedbackRateLimit(ip: string): boolean {
  const now = nowFn();
  cleanup(now);
  let bucket = buckets.get(ip);

  if (!bucket) {
    makeRoom();
    bucket = { tokens: CAPACITY, lastMs: now };
    buckets.set(ip, bucket);
  }

  const elapsedSeconds = Math.max(0, now - bucket.lastMs) / 1000;
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsedSeconds * REFILL_PER_SECOND);
  bucket.lastMs = now;

  if (bucket.tokens < 1) {
    return false;
  }

  bucket.tokens -= 1;
  return true;
}

export function resetFeedbackRateLimiterForTests(): void {
  buckets.clear();
  nowFn = () => Date.now();
}

export function setFeedbackRateLimiterNowForTests(now: () => number): void {
  nowFn = now;
}
