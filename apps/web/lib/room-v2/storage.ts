import {
  ACTIVE_ROOM_SESSION_KEY,
  type ActiveRoomSession,
} from '@/lib/room-v2/types';
import { writeReconnectClaim } from '@/lib/room-v2/reconnect-claims';

const LEGACY_SESSION_KEYS = [
  'wanasatna:playerId',
  'wanasatna:roomId',
  'wanasatna:playerName',
  'wanasatna:roomCode',
  'wanasatna:roomEntryGeneration',
  'wanasatna:active-room-resume',
] as const;

const LEGACY_RECONNECT_PREFIX = 'wanasatna:reconnect:';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function purgeLegacyRoomStorage(): void {
  if (!isBrowser()) {
    return;
  }

  try {
    for (const key of LEGACY_SESSION_KEYS) {
      window.sessionStorage.removeItem(key);
    }

    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(LEGACY_RECONNECT_PREFIX)) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable */
  }
}

export function readPersistedActiveRoomSession(): ActiveRoomSession | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(ACTIVE_ROOM_SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<ActiveRoomSession>;
    if (
      typeof parsed.roomId !== 'string' ||
      typeof parsed.roomCode !== 'string' ||
      typeof parsed.playerId !== 'string' ||
      typeof parsed.playerName !== 'string' ||
      typeof parsed.reconnectToken !== 'string'
    ) {
      return null;
    }

    return {
      roomId: parsed.roomId,
      roomCode: parsed.roomCode,
      playerId: parsed.playerId,
      playerName: parsed.playerName,
      reconnectToken: parsed.reconnectToken,
    };
  } catch {
    return null;
  }
}

export function writePersistedActiveRoomSession(session: ActiveRoomSession): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.sessionStorage.setItem(ACTIVE_ROOM_SESSION_KEY, JSON.stringify(session));
    writeReconnectClaim(session);
    purgeLegacyRoomStorage();
  } catch {
    /* storage unavailable */
  }
}

export function clearPersistedActiveRoomSession(): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(ACTIVE_ROOM_SESSION_KEY);
  } catch {
    /* storage unavailable */
  }

  purgeLegacyRoomStorage();
}
