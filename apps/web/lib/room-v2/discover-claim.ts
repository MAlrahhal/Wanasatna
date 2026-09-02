import { canonicalizeJoinRoomCode } from '@/lib/room-v2/join-intent';
import { listReconnectClaims } from '@/lib/room-v2/reconnect-claims';
import { readPersistedActiveRoomSession } from '@/lib/room-v2/storage';
import type { ActiveRoomSession } from '@/lib/room-v2/types';

const discoveryListeners = new Set<() => void>();
const listSnapshotByScope = new Map<string, ActiveRoomSession[]>();
export const EMPTY_RESUME_CLAIMS: ActiveRoomSession[] = [];

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

function sameClaimList(left: ActiveRoomSession[], right: ActiveRoomSession[]): boolean {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }
  return left.every((claim, index) => sameClaim(claim, right[index] ?? null));
}

function isLiveTabSession(claim: ActiveRoomSession, live: ActiveRoomSession | null): boolean {
  return Boolean(
    live &&
      live.playerId === claim.playerId &&
      canonicalizeJoinRoomCode(live.roomCode) === canonicalizeJoinRoomCode(claim.roomCode),
  );
}

function compareClaims(left: ActiveRoomSession, right: ActiveRoomSession): number {
  const byCode = canonicalizeJoinRoomCode(left.roomCode).localeCompare(
    canonicalizeJoinRoomCode(right.roomCode),
  );
  if (byCode !== 0) {
    return byCode;
  }
  return left.playerName.trim().localeCompare(right.playerName.trim(), 'ar');
}

/**
 * Persistent claims that may be offered as explicit recovery.
 * Excludes the identity this tab already holds. Does not auto-pick.
 */
export function listDiscoverableReconnectClaims(roomCode?: string | null): ActiveRoomSession[] {
  const expected = roomCode ? canonicalizeJoinRoomCode(roomCode) : '';
  const live = readPersistedActiveRoomSession();

  return listReconnectClaims()
    .filter((claim) => {
      if (expected && canonicalizeJoinRoomCode(claim.roomCode) !== expected) {
        return false;
      }
      return !isLiveTabSession(claim, live);
    })
    .sort(compareClaims);
}

/**
 * Cold-start recovery for a single unambiguous claim.
 * Homepage with no code uses this when exactly one discoverable claim exists.
 * Never auto-picks among multiple names/rooms.
 */
export function discoverResumableRoomSession(roomCode?: string | null): ActiveRoomSession | null {
  const matches = listDiscoverableReconnectClaims(roomCode);
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

export function getResumeDiscoveryListSnapshot(roomCode?: string | null): ActiveRoomSession[] {
  const scope = roomCode ? canonicalizeJoinRoomCode(roomCode) : '';
  const next = listDiscoverableReconnectClaims(scope || null);

  if (next.length === 0) {
    listSnapshotByScope.set(scope, EMPTY_RESUME_CLAIMS);
    return EMPTY_RESUME_CLAIMS;
  }

  const previous = listSnapshotByScope.get(scope);
  if (previous && sameClaimList(previous, next)) {
    return previous;
  }

  listSnapshotByScope.set(scope, next);
  return next;
}

export function getResumeDiscoverySnapshot(roomCode?: string | null): ActiveRoomSession | null {
  const list = getResumeDiscoveryListSnapshot(roomCode);
  return list.length === 1 ? (list[0] ?? null) : null;
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
  listSnapshotByScope.clear();
  for (const listener of discoveryListeners) {
    listener();
  }
}
