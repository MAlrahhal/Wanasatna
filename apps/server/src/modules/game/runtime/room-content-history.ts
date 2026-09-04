/**
 * Short-lived, in-memory recent-content history scoped to a room.
 * Survives consecutive matches; cleared only when the room runtime is destroyed.
 * Not persisted. Timing Challenge has no content history.
 */
export const ROOM_CONTENT_HISTORY_KEY = {
  BARA_AL_SALAFA: 'bara-al-salafa',
  DRAWABLE_WORDS: 'drawable-words',
  FAST_ANSWER: 'fast-answer',
  GUESSING_CHALLENGE: 'guessing-challenge',
  WHO_WROTE_IT: 'who-wrote-it',
  JUDGE: 'judge',
} as const;

export type RoomContentHistoryKey =
  (typeof ROOM_CONTENT_HISTORY_KEY)[keyof typeof ROOM_CONTENT_HISTORY_KEY];

export const ROOM_CONTENT_HISTORY_LIMIT = {
  [ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA]: 32,
  [ROOM_CONTENT_HISTORY_KEY.DRAWABLE_WORDS]: 32,
  [ROOM_CONTENT_HISTORY_KEY.FAST_ANSWER]: 32,
  [ROOM_CONTENT_HISTORY_KEY.GUESSING_CHALLENGE]: 32,
  [ROOM_CONTENT_HISTORY_KEY.WHO_WROTE_IT]: 24,
  [ROOM_CONTENT_HISTORY_KEY.JUDGE]: 24,
} as const;

const historyByRoomId = new Map<string, Map<string, string[]>>();

function historyLimitFor(historyKey: string, limit?: number): number {
  if (typeof limit === 'number' && limit > 0) {
    return limit;
  }

  const known = ROOM_CONTENT_HISTORY_LIMIT[historyKey as RoomContentHistoryKey];
  return known ?? 32;
}

function roomMap(roomId: string): Map<string, string[]> {
  let nested = historyByRoomId.get(roomId);
  if (!nested) {
    nested = new Map();
    historyByRoomId.set(roomId, nested);
  }
  return nested;
}

export function getRoomContentHistory(roomId: string, historyKey: string): readonly string[] {
  return historyByRoomId.get(roomId)?.get(historyKey) ?? [];
}

export function recordRoomContentHistory(
  roomId: string,
  historyKey: string,
  entry: string,
  limit?: number,
): void {
  if (!roomId || !historyKey || !entry) {
    return;
  }

  const cap = historyLimitFor(historyKey, limit);
  const nested = roomMap(roomId);
  const previous = nested.get(historyKey) ?? [];
  const next = [...previous.filter((value) => value !== entry), entry];

  if (next.length > cap) {
    next.splice(0, next.length - cap);
  }

  nested.set(historyKey, next);
}

/** Clears every history namespace for a room. Call only on true room teardown. */
export function clearRoomContentHistory(roomId: string): void {
  historyByRoomId.delete(roomId);
}

export function clearAllRoomContentHistoryForTests(): void {
  historyByRoomId.clear();
}
