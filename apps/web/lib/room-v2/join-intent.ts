import type { ActiveRoomSession } from '@/lib/room-v2/types';

export function canonicalizeJoinRoomCode(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function playerNamesMatch(left: string, right: string): boolean {
  return left.trim() === right.trim();
}

/**
 * Explicit Home Join submit: reconnect only the exact stored room+name+token.
 * Different name or room is always a fresh JOIN.
 * `stored` may be the tab sessionStorage session or a persistent same-browser claim.
 */
export function resolveExplicitJoinIntent(
  stored: ActiveRoomSession | null,
  roomCode: string,
  playerName: string,
): 'reconnect' | 'join' {
  if (!stored?.playerId || !stored.reconnectToken) {
    return 'join';
  }

  if (canonicalizeJoinRoomCode(stored.roomCode) !== canonicalizeJoinRoomCode(roomCode)) {
    return 'join';
  }

  if (!playerNamesMatch(stored.playerName, playerName)) {
    return 'join';
  }

  return 'reconnect';
}

/**
 * Prefer the live tab session; otherwise a matching persistent claim.
 * Never selects a claim by roomCode alone.
 */
export function selectExplicitJoinReconnectIdentity(
  activeSession: ActiveRoomSession | null,
  persistentClaim: ActiveRoomSession | null,
  roomCode: string,
  playerName: string,
): ActiveRoomSession | null {
  if (resolveExplicitJoinIntent(activeSession, roomCode, playerName) === 'reconnect') {
    return activeSession;
  }

  if (resolveExplicitJoinIntent(persistentClaim, roomCode, playerName) === 'reconnect') {
    return persistentClaim;
  }

  return null;
}

/**
 * Code-only resume stays allowed when no explicit name is present.
 * An explicit URL name must match the stored display name or resume is forbidden.
 */
export function canAutoResumeWithExplicitName(
  stored: ActiveRoomSession | null,
  explicitName: string | null | undefined,
): boolean {
  const name = explicitName?.trim() ?? '';
  if (!name) {
    return true;
  }

  if (!stored) {
    return false;
  }

  return playerNamesMatch(stored.playerName, name);
}

const TERMINAL_RESUME_FAILURE_CODES = new Set([
  'PLAYER_NOT_FOUND',
  'RECONNECT_EXPIRED',
  'RECONNECT_INVALID_TOKEN',
  'ROOM_NOT_FOUND',
  'ROOM_CLOSED',
  'VALIDATION_ERROR',
]);

export function isTerminalResumeFailure(code: string): boolean {
  return TERMINAL_RESUME_FAILURE_CODES.has(code);
}
