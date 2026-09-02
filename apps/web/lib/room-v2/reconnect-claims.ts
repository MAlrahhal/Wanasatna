import { canonicalizeJoinRoomCode } from '@/lib/room-v2/join-intent';
import type { ActiveRoomSession } from '@/lib/room-v2/types';

/** Versioned Room V2 reconnect claims. Must NOT use the legacy `wanasatna:reconnect:` prefix. */
export const RECONNECT_CLAIMS_STORAGE_KEY = 'wanasatna:v2:reconnect-claims' as const;

type ReconnectClaimMap = Record<string, ActiveRoomSession>;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function claimKey(roomCode: string, playerName: string): string {
  return `${canonicalizeJoinRoomCode(roomCode)}\u001f${playerName.trim()}`;
}

function isCompleteClaim(value: Partial<ActiveRoomSession> | null | undefined): value is ActiveRoomSession {
  return Boolean(
    value &&
      typeof value.roomId === 'string' &&
      value.roomId &&
      typeof value.roomCode === 'string' &&
      value.roomCode &&
      typeof value.playerId === 'string' &&
      value.playerId &&
      typeof value.playerName === 'string' &&
      value.playerName.trim() &&
      typeof value.reconnectToken === 'string' &&
      value.reconnectToken,
  );
}

function readClaimMap(): ReconnectClaimMap {
  if (!isBrowser()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(RECONNECT_CLAIMS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const next: ReconnectClaimMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, Partial<ActiveRoomSession>>)) {
      if (isCompleteClaim(value)) {
        next[key] = {
          roomId: value.roomId,
          roomCode: value.roomCode,
          playerId: value.playerId,
          playerName: value.playerName,
          reconnectToken: value.reconnectToken,
        };
      }
    }
    return next;
  } catch {
    return {};
  }
}

function writeClaimMap(map: ReconnectClaimMap): void {
  if (!isBrowser()) {
    return;
  }

  try {
    if (Object.keys(map).length === 0) {
      window.localStorage.removeItem(RECONNECT_CLAIMS_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(RECONNECT_CLAIMS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable */
  }
}

export function writeReconnectClaim(session: ActiveRoomSession): void {
  if (!isCompleteClaim(session)) {
    return;
  }

  const map = readClaimMap();
  map[claimKey(session.roomCode, session.playerName)] = {
    roomId: session.roomId,
    roomCode: session.roomCode,
    playerId: session.playerId,
    playerName: session.playerName,
    reconnectToken: session.reconnectToken,
  };
  writeClaimMap(map);
}

export function readReconnectClaim(roomCode: string, playerName: string): ActiveRoomSession | null {
  const claim = readClaimMap()[claimKey(roomCode, playerName)];
  return claim ?? null;
}

export function removeReconnectClaim(roomCode: string, playerName: string): void {
  const map = readClaimMap();
  const key = claimKey(roomCode, playerName);
  if (!(key in map)) {
    return;
  }

  delete map[key];
  writeClaimMap(map);
}

export function listReconnectClaims(): ActiveRoomSession[] {
  return Object.values(readClaimMap());
}

/**
 * Cold-start discovery: only when exactly one complete claim matches.
 * Pass a room code to scope to that room; omit it to require a single claim in the browser.
 * Never picks among multiple names in the same room.
 */
export function findUniqueReconnectClaim(roomCode?: string | null): ActiveRoomSession | null {
  const expected = roomCode ? canonicalizeJoinRoomCode(roomCode) : '';
  const matches = listReconnectClaims().filter((claim) => {
    if (!expected) {
      return true;
    }
    return canonicalizeJoinRoomCode(claim.roomCode) === expected;
  });

  if (matches.length !== 1) {
    return null;
  }

  return matches[0] ?? null;
}

export function removeReconnectClaimForSession(
  session: Pick<ActiveRoomSession, 'roomCode' | 'playerName'> | null | undefined,
): void {
  if (!session) {
    return;
  }

  removeReconnectClaim(session.roomCode, session.playerName);
}
