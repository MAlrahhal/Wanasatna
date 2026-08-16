import type { Socket } from 'socket.io';
import { getClientIp } from './client-ip.js';

export const RATE_LIMITED_USER_MESSAGE =
  'طلبات كثيرة بسرعة، انتظر شوي وحاول مرة ثانية.';

export const ROOM_ENTRY_IN_PROGRESS_USER_MESSAGE =
  'يتم الدخول للغرفة الآن، حاول مرة ثانية.';

type AbuseAction =
  | 'create-room'
  | 'join-room'
  | 'reconnect'
  | 'room-sync'
  | 'game-sync'
  | 'gc-look'
  | 'connect';

type TokenPolicy = {
  capacity: number;
  refillPerSecond: number;
};

type Bucket = {
  tokens: number;
  lastMs: number;
};

const SOCKET_POLICIES: Record<Exclude<AbuseAction, 'connect'>, TokenPolicy> = {
  'create-room': { capacity: 3, refillPerSecond: 3 / 60 },
  'join-room': { capacity: 20, refillPerSecond: 20 / 60 },
  reconnect: { capacity: 30, refillPerSecond: 30 / 60 },
  'room-sync': { capacity: 4, refillPerSecond: 2 },
  'game-sync': { capacity: 4, refillPerSecond: 2 },
  'gc-look': { capacity: 30, refillPerSecond: 20 },
};

const IP_POLICIES: Record<'create-room' | 'join-room' | 'reconnect' | 'connect', TokenPolicy> = {
  'create-room': { capacity: 20, refillPerSecond: 20 / 60 },
  'join-room': { capacity: 120, refillPerSecond: 120 / 60 },
  reconnect: { capacity: 180, refillPerSecond: 180 / 60 },
  connect: { capacity: 120, refillPerSecond: 2 },
};

const IDLE_MS = 120_000;
const CLEANUP_INTERVAL_MS = 30_000;
const MAX_IP_KEYS = 20_000;

const socketStores = new Map<string, Map<AbuseAction, Bucket>>();
const ipStores = new Map<string, Map<AbuseAction, Bucket>>();

let nowFn = (): number => Date.now();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function setAbuseLimiterNow(now: () => number): void {
  nowFn = now;
}

export function resetAbuseLimiterForTests(): void {
  socketStores.clear();
  ipStores.clear();
  nowFn = () => Date.now();
  stopAbuseLimiterCleanup();
}

export function startAbuseLimiterCleanup(): void {
  if (cleanupTimer) {
    return;
  }

  cleanupTimer = setInterval(() => {
    sweepIdleAbuseBuckets();
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
}

export function stopAbuseLimiterCleanup(): void {
  if (!cleanupTimer) {
    return;
  }

  clearInterval(cleanupTimer);
  cleanupTimer = null;
}

export function forgetSocketAbuseState(socketId: string): void {
  socketStores.delete(socketId);
}

export function sweepIdleAbuseBuckets(now = nowFn()): number {
  const removed =
    pruneStore(socketStores, now) + pruneStore(ipStores, now);

  if (ipStores.size > MAX_IP_KEYS) {
    evictOldestIpKeys(now, Math.ceil(ipStores.size * 0.1));
  }

  return removed;
}

export function abuseLimiterBucketCounts(): { sockets: number; ips: number } {
  return { sockets: socketStores.size, ips: ipStores.size };
}

function pruneStore(
  store: Map<string, Map<AbuseAction, Bucket>>,
  now: number,
): number {
  let removed = 0;

  for (const [id, buckets] of store) {
    for (const [action, bucket] of buckets) {
      if (now - bucket.lastMs >= IDLE_MS) {
        buckets.delete(action);
        removed += 1;
      }
    }

    if (buckets.size === 0) {
      store.delete(id);
    }
  }

  return removed;
}

function evictOldestIpKeys(now: number, count: number): void {
  const ranked = [...ipStores.entries()]
    .map(([ip, buckets]) => {
      let oldest = now;
      for (const bucket of buckets.values()) {
        if (bucket.lastMs < oldest) {
          oldest = bucket.lastMs;
        }
      }
      return { ip, oldest };
    })
    .sort((left, right) => left.oldest - right.oldest);

  for (const entry of ranked.slice(0, count)) {
    ipStores.delete(entry.ip);
  }
}

function refill(bucket: Bucket, policy: TokenPolicy, now: number): void {
  const elapsedSec = Math.max(0, now - bucket.lastMs) / 1000;
  bucket.tokens = Math.min(policy.capacity, bucket.tokens + elapsedSec * policy.refillPerSecond);
  bucket.lastMs = now;
}

function getBucket(
  store: Map<string, Map<AbuseAction, Bucket>>,
  id: string,
  action: AbuseAction,
  policy: TokenPolicy,
  now: number,
): Bucket {
  let buckets = store.get(id);

  if (!buckets) {
    buckets = new Map();
    store.set(id, buckets);
  }

  let bucket = buckets.get(action);

  if (!bucket) {
    bucket = { tokens: policy.capacity, lastMs: now };
    buckets.set(action, bucket);
  }

  return bucket;
}

function tryConsumeBucket(bucket: Bucket, policy: TokenPolicy, now: number): boolean {
  refill(bucket, policy, now);

  if (bucket.tokens < 1) {
    return false;
  }

  bucket.tokens -= 1;
  return true;
}

function tryConsumeSocket(socketId: string, action: Exclude<AbuseAction, 'connect'>, now: number): boolean {
  const policy = SOCKET_POLICIES[action];
  const bucket = getBucket(socketStores, socketId, action, policy, now);
  return tryConsumeBucket(bucket, policy, now);
}

function tryConsumeIp(ip: string, action: keyof typeof IP_POLICIES, now: number): boolean {
  const policy = IP_POLICIES[action];
  const bucket = getBucket(ipStores, ip, action, policy, now);
  return tryConsumeBucket(bucket, policy, now);
}

function tryConsumeSocketAndIp(
  socket: Socket,
  action: 'create-room' | 'join-room' | 'reconnect',
): boolean {
  const now = nowFn();
  const ip = getClientIp(socket);
  const socketPolicy = SOCKET_POLICIES[action];
  const ipPolicy = IP_POLICIES[action];
  const socketBucket = getBucket(socketStores, socket.id, action, socketPolicy, now);
  const ipBucket = getBucket(ipStores, ip, action, ipPolicy, now);

  refill(socketBucket, socketPolicy, now);
  refill(ipBucket, ipPolicy, now);

  if (socketBucket.tokens < 1 || ipBucket.tokens < 1) {
    return false;
  }

  socketBucket.tokens -= 1;
  ipBucket.tokens -= 1;
  return true;
}

export function consumeCreateRoomLimit(socket: Socket): boolean {
  return tryConsumeSocketAndIp(socket, 'create-room');
}

export function consumeJoinRoomLimit(socket: Socket): boolean {
  return tryConsumeSocketAndIp(socket, 'join-room');
}

export function consumeReconnectLimit(socket: Socket): boolean {
  return tryConsumeSocketAndIp(socket, 'reconnect');
}

export function consumeRoomSyncLimit(socket: Socket): boolean {
  return tryConsumeSocket(socket.id, 'room-sync', nowFn());
}

export function consumeGameSyncLimit(socket: Socket): boolean {
  return tryConsumeSocket(socket.id, 'game-sync', nowFn());
}

export function consumeConnectLimit(socket: Socket): boolean {
  return tryConsumeIp(getClientIp(socket), 'connect', nowFn());
}

export function consumeLookLimit(socket: Socket): boolean {
  return tryConsumeSocket(socket.id, 'gc-look', nowFn());
}
