import { canonicalizeJoinRoomCode } from '@/lib/room-v2/join-intent';
import { listReconnectClaimsNewestFirst } from '@/lib/room-v2/reconnect-claims';
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

/**
 * At most one recovery claim: the newest matching seat this tab is not already in.
 * Historical rooms stay in localStorage for exact-name Join, but are not offered here.
 */
export function listDiscoverableReconnectClaims(roomCode?: string | null): ActiveRoomSession[] {
  const expected = roomCode ? canonicalizeJoinRoomCode(roomCode) : '';
  const live = readPersistedActiveRoomSession();
  const newestFirst = listReconnectClaimsNewestFirst();

  if (expected) {
    const latestForRoom = newestFirst.find(
      (claim) => canonicalizeJoinRoomCode(claim.roomCode) === expected,
    );
    if (!latestForRoom || isLiveTabSession(latestForRoom, live)) {
      return [];
    }
    return [latestForRoom];
  }

  const latest = newestFirst[0];
  if (!latest || isLiveTabSession(latest, live)) {
    return [];
  }

  return [latest];
}

/**
 * Homepage / invite recovery: newest usable claim only.
 */
export function discoverResumableRoomSession(roomCode?: string | null): ActiveRoomSession | null {
  return listDiscoverableReconnectClaims(roomCode)[0] ?? null;
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
  return getResumeDiscoveryListSnapshot(roomCode)[0] ?? null;
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
