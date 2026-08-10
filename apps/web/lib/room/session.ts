import { disconnectRoomSocket } from '@/lib/room/socket';
import {
  findRoomReconnectCredential,
  removeRoomReconnectCredential,
  type RoomReconnectCredential,
} from '@/lib/room/reconnect-credential';

export const ROOM_SESSION_STORAGE_KEYS = {
  playerId: 'wanasatna:playerId',
  roomId: 'wanasatna:roomId',
  playerName: 'wanasatna:playerName',
  roomCode: 'wanasatna:roomCode',
  selectedGameId: 'wanasatna:selectedGameId',
} as const;

const PLAYER_ID_KEY = ROOM_SESSION_STORAGE_KEYS.playerId;
const ROOM_ID_KEY = ROOM_SESSION_STORAGE_KEYS.roomId;
const PLAYER_NAME_KEY = ROOM_SESSION_STORAGE_KEYS.playerName;
const ROOM_CODE_KEY = ROOM_SESSION_STORAGE_KEYS.roomCode;
const SELECTED_GAME_KEY = ROOM_SESSION_STORAGE_KEYS.selectedGameId;

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

export function buildLobbyUrl(roomCode: string): string {
  return `/lobby?code=${encodeURIComponent(roomCode)}`;
}

export function lobbyUrlNeedsNormalization(
  params: Pick<URLSearchParams, 'get' | 'has'>,
  roomCode: string,
): boolean {
  const currentCode = params.get('code')?.trim() ?? '';
  const hasIntentParams = params.has('name') || params.has('action');

  return currentCode !== roomCode || hasIntentParams;
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

export function resolveRoomEntryIntent(
  params: Pick<URLSearchParams, 'get'>,
  storedSession: RoomSession | null,
  roomCodeForCredential?: string | null,
): RoomEntryIntent {
  const action = params.get('action');
  const playerName = params.get('name')?.trim() ?? '';
  const roomCode = params.get('code')?.trim() ?? '';

  if (action === 'create' && playerName) {
    return { type: 'create', playerName };
  }

  // Cross-room URL must never resurrect another room's session/reconnect identity.
  // Example bug: /lobby?code=B while sessionStorage still holds Room A → reconnect A
  // and rewrite the URL back to A.
  const sessionConflictsWithUrl = Boolean(
    roomCode && storedSession && storedSession.roomCode !== roomCode,
  );

  if (sessionConflictsWithUrl) {
    if (playerName) {
      return { type: 'join', roomCode, playerName };
    }

    const targetCredential = findRoomReconnectCredential(roomCode);

    if (targetCredential) {
      return reconnectIntentFromCredential(targetCredential);
    }

    return { type: 'none' };
  }

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

  if (roomCode && playerName) {
    return { type: 'join', roomCode, playerName };
  }

  if (storedSession) {
    const sessionCredential = findRoomReconnectCredential(storedSession.roomCode);

    if (sessionCredential && sessionCredential.playerId === storedSession.playerId) {
      return reconnectIntentFromCredential(sessionCredential);
    }
  }

  return { type: 'none' };
}

export function beginNewRoomIdentity(roomCode?: string): void {
  // Read session before clearing so explicit leave always drops the room-scoped
  // reconnect credential even when callers omit roomCode (e.g. leaveActiveRoom).
  const codeToClear = (roomCode ?? readRoomSession()?.roomCode)?.trim() || null;

  clearRoomSession();

  if (codeToClear) {
    removeRoomReconnectCredential(codeToClear);
  }

  disconnectRoomSocket();
}

export function resetWanasatnaRoomSession(): void {
  beginNewRoomIdentity();
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
