import { disconnectRoomSocket } from '@/lib/room/socket';
import {
  clearActiveRoomReconnectCredential,
  findRoomReconnectCredential,
  purgeLegacyLocalStorageRoomIdentity,
  removeRoomReconnectCredential,
  type RoomReconnectCredential,
} from '@/lib/room/reconnect-credential';

export const ROOM_SESSION_STORAGE_KEYS = {
  playerId: 'wanasatna:playerId',
  roomId: 'wanasatna:roomId',
  playerName: 'wanasatna:playerName',
  roomCode: 'wanasatna:roomCode',
  selectedGameId: 'wanasatna:selectedGameId',
  /** Bumps on each fresh room entry so late ACKs from a prior intent are ignored. */
  entryGeneration: 'wanasatna:roomEntryGeneration',
} as const;

const PLAYER_ID_KEY = ROOM_SESSION_STORAGE_KEYS.playerId;
const ROOM_ID_KEY = ROOM_SESSION_STORAGE_KEYS.roomId;
const PLAYER_NAME_KEY = ROOM_SESSION_STORAGE_KEYS.playerName;
const ROOM_CODE_KEY = ROOM_SESSION_STORAGE_KEYS.roomCode;
const SELECTED_GAME_KEY = ROOM_SESSION_STORAGE_KEYS.selectedGameId;
const ENTRY_GENERATION_KEY = ROOM_SESSION_STORAGE_KEYS.entryGeneration;

/**
 * Ephemeral RoomPlayer participation for the current tab.
 * This is NOT a User/Account identity and must not outlive explicit Leave
 * or a fresh Create / different-room Join.
 */
export type RoomSession = {
  playerId: string;
  roomId: string;
  playerName: string;
  roomCode: string;
};

export type RoomEntryIntent =
  | { type: 'create'; playerName: string }
  | { type: 'join'; roomCode: string; playerName: string }
  | {
      type: 'reconnect';
      playerId: string;
      roomId: string;
      roomCode: string;
      reconnectToken: string;
    }
  | { type: 'none' };

export function readRoomSession(): RoomSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const playerId = window.sessionStorage.getItem(PLAYER_ID_KEY);
  const roomId = window.sessionStorage.getItem(ROOM_ID_KEY);
  const playerName = window.sessionStorage.getItem(PLAYER_NAME_KEY);
  const roomCode = window.sessionStorage.getItem(ROOM_CODE_KEY);

  if (!playerId || !roomId || !playerName || !roomCode) {
    return null;
  }

  return { playerId, roomId, playerName, roomCode };
}

export function writeRoomSession(session: RoomSession): void {
  window.sessionStorage.setItem(PLAYER_ID_KEY, session.playerId);
  window.sessionStorage.setItem(ROOM_ID_KEY, session.roomId);
  window.sessionStorage.setItem(PLAYER_NAME_KEY, session.playerName);
  window.sessionStorage.setItem(ROOM_CODE_KEY, session.roomCode);
}

export function clearRoomSession(): void {
  window.sessionStorage.removeItem(PLAYER_ID_KEY);
  window.sessionStorage.removeItem(ROOM_ID_KEY);
  window.sessionStorage.removeItem(PLAYER_NAME_KEY);
  window.sessionStorage.removeItem(ROOM_CODE_KEY);
  window.sessionStorage.removeItem(SELECTED_GAME_KEY);
}

export function readSelectedGameId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage.getItem(SELECTED_GAME_KEY);
}

export function writeSelectedGameId(gameId: string | null): void {
  if (gameId) {
    window.sessionStorage.setItem(SELECTED_GAME_KEY, gameId);
    return;
  }

  window.sessionStorage.removeItem(SELECTED_GAME_KEY);
}

export function bumpRoomEntryGeneration(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  const next = (Number(window.sessionStorage.getItem(ENTRY_GENERATION_KEY) ?? '0') || 0) + 1;
  window.sessionStorage.setItem(ENTRY_GENERATION_KEY, String(next));
  return next;
}

export function readRoomEntryGeneration(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  return Number(window.sessionStorage.getItem(ENTRY_GENERATION_KEY) ?? '0') || 0;
}

export function buildLobbyUrl(roomCode: string): string {
  return `/lobby?code=${encodeURIComponent(roomCode)}`;
}

/** Home invite path — prefills join code; no room session required. */
export function buildRoomInvitePath(roomCode: string): string {
  return `/?code=${encodeURIComponent(roomCode)}`;
}

/** Absolute joinable invite URL for clipboard sharing. */
export function buildRoomInviteUrl(roomCode: string, origin?: string): string {
  const path = buildRoomInvitePath(roomCode);
  const resolvedOrigin = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return resolvedOrigin ? `${resolvedOrigin}${path}` : path;
}

export function lobbyUrlNeedsNormalization(
  params: Pick<URLSearchParams, 'get' | 'has'>,
  roomCode: string,
): boolean {
  const currentCode = params.get('code')?.trim() ?? '';
  const hasIntentParams = params.has('name') || params.has('action');

  return currentCode !== roomCode || hasIntentParams;
}

/**
 * Canonical active-room URL: `/lobby?code=XXXXXX`
 * After Create/Join success, one-shot intent params must not remain authoritative.
 */
export function toCanonicalLobbySearchParams(roomCode: string): URLSearchParams {
  const nextParams = new URLSearchParams();
  nextParams.set('code', roomCode);
  return nextParams;
}

function reconnectIntentFromCredential(
  credential: RoomReconnectCredential,
): Extract<RoomEntryIntent, { type: 'reconnect' }> {
  return {
    type: 'reconnect',
    playerId: credential.playerId,
    roomId: credential.roomId,
    roomCode: credential.roomCode,
    reconnectToken: credential.reconnectToken,
  };
}

/**
 * Resolve how this tab should enter a room.
 *
 * Contract:
 * - Fresh Create / Join → new RoomPlayer (unless sticky intent was already consumed)
 * - Same-room code-only URL (refresh) → reconnect when resume credential matches
 * - Never reconnect Room A while URL targets Room B
 */
export function resolveRoomEntryIntent(
  params: Pick<URLSearchParams, 'get'>,
  storedSession: RoomSession | null,
  roomCodeForCredential?: string | null,
): RoomEntryIntent {
  const action = params.get('action');
  const playerName = params.get('name')?.trim() ?? '';
  const roomCode = params.get('code')?.trim() ?? '';

  // Sticky create URL after success: only treat as consumed when the typed
  // create name matches the active RoomPlayer (same intent already applied).
  // Mismatched / legacy poisoned sessions must not block a fresh Create.
  if (action === 'create' && playerName) {
    if (storedSession && storedSession.playerName === playerName) {
      const sessionCredential = findRoomReconnectCredential(storedSession.roomCode);
      if (sessionCredential && sessionCredential.playerId === storedSession.playerId) {
        return reconnectIntentFromCredential(sessionCredential);
      }
    }
    return { type: 'create', playerName };
  }

  // Sticky join URL (code+name) after success for the SAME room → reconnect.
  if (roomCode && playerName) {
    if (storedSession && storedSession.roomCode === roomCode) {
      const sessionCredential = findRoomReconnectCredential(storedSession.roomCode);
      if (sessionCredential && sessionCredential.playerId === storedSession.playerId) {
        return reconnectIntentFromCredential(sessionCredential);
      }
    }
    return { type: 'join', roomCode, playerName };
  }

  // Cross-room URL must never resurrect another room's session/reconnect identity.
  const sessionConflictsWithUrl = Boolean(
    roomCode && storedSession && storedSession.roomCode !== roomCode,
  );

  if (sessionConflictsWithUrl) {
    const targetCredential = findRoomReconnectCredential(roomCode);

    if (targetCredential) {
      return reconnectIntentFromCredential(targetCredential);
    }

    return { type: 'none' };
  }

  // CASE 3 — Same-room refresh / temporary disconnect (code-only URL).
  const credential = findRoomReconnectCredential(roomCodeForCredential ?? roomCode);

  if (roomCode && credential?.roomCode === roomCode) {
    return reconnectIntentFromCredential(credential);
  }

  if (storedSession && roomCode && storedSession.roomCode === roomCode) {
    const sessionCredential = findRoomReconnectCredential(storedSession.roomCode);

    if (sessionCredential && sessionCredential.playerId === storedSession.playerId) {
      return reconnectIntentFromCredential(sessionCredential);
    }
  }

  if (storedSession && !roomCode) {
    const sessionCredential = findRoomReconnectCredential(storedSession.roomCode);

    if (sessionCredential && sessionCredential.playerId === storedSession.playerId) {
      return reconnectIntentFromCredential(sessionCredential);
    }
  }

  return { type: 'none' };
}

/**
 * Clear Room participation storage without disconnecting the socket.
 * Used by Leave so an already-bound socket can emit leave before teardown.
 */
export function clearLocalRoomParticipationStorage(roomCode?: string): void {
  purgeLegacyLocalStorageRoomIdentity();

  const codeToClear = (roomCode ?? readRoomSession()?.roomCode)?.trim() || null;

  clearRoomSession();

  if (codeToClear) {
    removeRoomReconnectCredential(codeToClear);
  } else {
    clearActiveRoomReconnectCredential();
  }
}

/**
 * Destroy local Room participation identity only.
 *
 * Does NOT clear future Account/Auth identity (tokens, userId, profile).
 * Room leave ≠ account logout.
 */
export function resetRoomParticipationIdentity(roomCode?: string): void {
  clearLocalRoomParticipationStorage(roomCode);
  disconnectRoomSocket();
}

/** @deprecated Prefer resetRoomParticipationIdentity — kept as a thin alias. */
export function beginNewRoomIdentity(roomCode?: string): void {
  resetRoomParticipationIdentity(roomCode);
}

export function resetWanasatnaRoomSession(): void {
  resetRoomParticipationIdentity();
}

export function shouldClearSessionOnReconnectFailure(code: string): boolean {
  return (
    code === 'PLAYER_NOT_FOUND' ||
    code === 'RECONNECT_EXPIRED' ||
    code === 'RECONNECT_INVALID_TOKEN' ||
    code === 'ROOM_NOT_FOUND' ||
    code === 'ROOM_CLOSED' ||
    code === 'CONNECTION_FAILED' ||
    code === 'VALIDATION_ERROR'
  );
}

export const STALE_ROOM_SESSION_MESSAGE =
  'انتهت صلاحية جلسة الغرفة المخزنة. يمكنك إنشاء غرفة جديدة أو الانضمام مرة أخرى.';
