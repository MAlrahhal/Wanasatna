const inFlight = new Set<string>();

export function tryBeginRoomEntry(socketId: string): boolean {
  if (inFlight.has(socketId)) {
    return false;
  }

  inFlight.add(socketId);
  return true;
}

export function endRoomEntry(socketId: string): void {
  inFlight.delete(socketId);
}

export function resetRoomEntryLocksForTests(): void {
  inFlight.clear();
}

export async function withRoomEntryLock<T>(
  socketId: string,
  work: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false }> {
  if (!tryBeginRoomEntry(socketId)) {
    return { ok: false };
  }

  try {
    return { ok: true, value: await work() };
  } finally {
    endRoomEntry(socketId);
  }
}
