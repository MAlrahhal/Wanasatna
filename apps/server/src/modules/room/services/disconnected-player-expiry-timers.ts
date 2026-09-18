type ExpiryTimerHandle = ReturnType<typeof setTimeout>;

export type ExpiryTimerClock = {
  now: () => number;
  setTimeout: (callback: () => void, delayMs: number) => ExpiryTimerHandle;
  clearTimeout: (handle: ExpiryTimerHandle) => void;
};

type PendingExpiry = {
  playerId: string;
  roomId: string;
  disconnectedAt: Date;
  deadlineAtMs: number;
  handle: ExpiryTimerHandle | null;
  onExpire: () => Promise<void>;
};

const defaultClock: ExpiryTimerClock = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle),
};

const pendingByPlayerId = new Map<string, PendingExpiry>();
let clock = defaultClock;

export function disconnectedPlayerExpiryNowMs(): number {
  return clock.now();
}

function arm(entry: PendingExpiry): void {
  const remainingMs = entry.deadlineAtMs - clock.now();

  if (remainingMs > 0) {
    entry.handle = clock.setTimeout(() => {
      const current = pendingByPlayerId.get(entry.playerId);
      if (current !== entry) {
        return;
      }

      arm(entry);
    }, remainingMs);
    entry.handle.unref?.();
    return;
  }

  const current = pendingByPlayerId.get(entry.playerId);
  if (current !== entry) {
    return;
  }

  pendingByPlayerId.delete(entry.playerId);
  entry.handle = null;
  void entry.onExpire();
}

export function scheduleDisconnectedPlayerExpiryTimer(input: {
  playerId: string;
  roomId: string;
  disconnectedAt: Date;
  deadlineAtMs: number;
  onExpire: () => Promise<void>;
}): void {
  cancelDisconnectedPlayerExpiryTimer(input.playerId);

  const entry: PendingExpiry = {
    ...input,
    disconnectedAt: new Date(input.disconnectedAt),
    handle: null,
  };
  pendingByPlayerId.set(input.playerId, entry);
  arm(entry);
}

export function cancelDisconnectedPlayerExpiryTimer(playerId: string): boolean {
  const entry = pendingByPlayerId.get(playerId);
  if (!entry) {
    return false;
  }

  pendingByPlayerId.delete(playerId);
  if (entry.handle) {
    clock.clearTimeout(entry.handle);
  }
  return true;
}

export function cancelRoomDisconnectedPlayerExpiryTimers(roomId: string): number {
  let cancelled = 0;

  for (const entry of [...pendingByPlayerId.values()]) {
    if (entry.roomId === roomId && cancelDisconnectedPlayerExpiryTimer(entry.playerId)) {
      cancelled += 1;
    }
  }

  return cancelled;
}

export function clearDisconnectedPlayerExpiryTimers(): void {
  for (const playerId of [...pendingByPlayerId.keys()]) {
    cancelDisconnectedPlayerExpiryTimer(playerId);
  }
}

export function getPendingDisconnectedPlayerExpiryForTests(playerId: string): {
  roomId: string;
  disconnectedAt: Date;
  deadlineAtMs: number;
} | null {
  const entry = pendingByPlayerId.get(playerId);
  if (!entry) {
    return null;
  }

  return {
    roomId: entry.roomId,
    disconnectedAt: new Date(entry.disconnectedAt),
    deadlineAtMs: entry.deadlineAtMs,
  };
}

export function setDisconnectedPlayerExpiryClockForTests(next: ExpiryTimerClock | null): void {
  clearDisconnectedPlayerExpiryTimers();
  clock = next ?? defaultClock;
}
