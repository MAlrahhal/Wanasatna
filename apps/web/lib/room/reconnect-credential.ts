/**
 * Guest Room reconnect credential — tab-scoped ephemeral RoomPlayer resume.
 *
 * This is NOT account identity. A future auth token / userId must never live here.
 * Explicit Leave / Create / Join-other-room must clear this record.
 */

export type RoomReconnectCredential = {
  playerId: string;
  roomId: string;
  roomCode: string;
  reconnectToken: string;
};

/** Single active resume record for this tab (sessionStorage). */
export const ACTIVE_ROOM_RESUME_STORAGE_KEY = 'wanasatna:active-room-resume';

/** Legacy production keys — must never resurrect identity after migration. */
export const LEGACY_RECONNECT_KEY_PREFIX = 'wanasatna:reconnect:';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function parseCredential(raw: string, expectedRoomCode?: string | null): RoomReconnectCredential | null {
  try {
    const parsed = JSON.parse(raw) as Partial<RoomReconnectCredential>;

    if (
      typeof parsed.playerId !== 'string' ||
      typeof parsed.roomId !== 'string' ||
      typeof parsed.roomCode !== 'string' ||
      typeof parsed.reconnectToken !== 'string'
    ) {
      return null;
    }

    if (expectedRoomCode && parsed.roomCode !== expectedRoomCode) {
      return null;
    }

    return {
      playerId: parsed.playerId,
      roomId: parsed.roomId,
      roomCode: parsed.roomCode,
      reconnectToken: parsed.reconnectToken,
    };
  } catch {
    return null;
  }
}

/**
 * Remove legacy localStorage reconnect keys from older production builds.
 * Safe to call on every room entry / identity reset.
 */
export function purgeLegacyLocalStorageRoomIdentity(): void {
  if (!isBrowser() || typeof window.localStorage === 'undefined') {
    return;
  }

  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(LEGACY_RECONNECT_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable */
  }
}

export function saveRoomReconnectCredential(credential: RoomReconnectCredential): void {
  if (!isBrowser() || typeof window.sessionStorage === 'undefined') {
    return;
  }

  try {
    // One active RoomPlayer resume per tab — never accumulate room-keyed ghosts.
    window.sessionStorage.setItem(ACTIVE_ROOM_RESUME_STORAGE_KEY, JSON.stringify(credential));
    purgeLegacyLocalStorageRoomIdentity();
  } catch {
    /* storage unavailable */
  }
}

export function readActiveRoomReconnectCredential(): RoomReconnectCredential | null {
  if (!isBrowser() || typeof window.sessionStorage === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(ACTIVE_ROOM_RESUME_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return parseCredential(raw);
  } catch {
    return null;
  }
}

export function readRoomReconnectCredential(roomCode: string): RoomReconnectCredential | null {
  const active = readActiveRoomReconnectCredential();
  if (!active || active.roomCode !== roomCode.trim()) {
    return null;
  }
  return active;
}

export function clearActiveRoomReconnectCredential(): void {
  if (!isBrowser() || typeof window.sessionStorage === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(ACTIVE_ROOM_RESUME_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }

  purgeLegacyLocalStorageRoomIdentity();
}

export function removeRoomReconnectCredential(roomCode?: string | null): void {
  const active = readActiveRoomReconnectCredential();

  if (!roomCode || !active || active.roomCode === roomCode.trim()) {
    clearActiveRoomReconnectCredential();
    return;
  }

  // Different room requested — still purge legacy keys; keep active only if same room.
  purgeLegacyLocalStorageRoomIdentity();
}

export function findRoomReconnectCredential(roomCode?: string | null): RoomReconnectCredential | null {
  if (!roomCode) {
    return null;
  }

  return readRoomReconnectCredential(roomCode.trim());
}
