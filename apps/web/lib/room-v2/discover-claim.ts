import { canonicalizeJoinRoomCode } from '@/lib/room-v2/join-intent';
import { findUniqueReconnectClaim } from '@/lib/room-v2/reconnect-claims';
import { readPersistedActiveRoomSession } from '@/lib/room-v2/storage';
import type { ActiveRoomSession } from '@/lib/room-v2/types';

const discoveryListeners = new Set<() => void>();
const snapshotByScope = new Map<string, ActiveRoomSession | null>();

function sameClaim(left: ActiveRoomSession | null, right: ActiveRoomSession | null): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    left.playerId === right.playerId &&
    left.roomId === right.roomId &&
    left.roomCode === right.roomCode &&
    left.playerName === right.playerName &&
    left.reconnectToken === right.reconnectToken
  );
}

/**
 * Prefer the live tab session; otherwise exactly one persistent claim.
 * Never auto-picks when multiple names/rooms are stored.
 */
export function discoverResumableRoomSession(roomCode?: string | null): ActiveRoomSession | null {
  const expected = roomCode ? canonicalizeJoinRoomCode(roomCode) : '';
  const session = readPersistedActiveRoomSession();

  if (
    session &&
    (!expected || canonicalizeJoinRoomCode(session.roomCode) === expected)
  ) {
    return session;
  }

  return findUniqueReconnectClaim(expected || null);
}

export function getResumeDiscoverySnapshot(roomCode?: string | null): ActiveRoomSession | null {
  const scope = roomCode ? canonicalizeJoinRoomCode(roomCode) : '';
  const next = discoverResumableRoomSession(scope || null);
  const previous = snapshotByScope.get(scope);

  if (sameClaim(previous ?? null, next)) {
    return previous ?? null;
  }

  snapshotByScope.set(scope, next);
  return next;
}

export function subscribeResumeDiscovery(onStoreChange: () => void): () => void {
  discoveryListeners.add(onStoreChange);
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStoreChange);
  }

  return () => {
    discoveryListeners.delete(onStoreChange);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStoreChange);
    }
  };
}

export function notifyResumeDiscovery(): void {
  snapshotByScope.clear();
  for (const listener of discoveryListeners) {
    listener();
  }
}
