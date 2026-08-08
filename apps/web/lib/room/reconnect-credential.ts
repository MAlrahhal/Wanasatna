export type RoomReconnectCredential = {
  playerId: string;
  roomId: string;
  roomCode: string;
  reconnectToken: string;
};

const RECONNECT_KEY_PREFIX = 'wanasatna:reconnect:';

function reconnectStorageKey(roomCode: string): string {
  return `${RECONNECT_KEY_PREFIX}${roomCode}`;
}

function isBrowserStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function saveRoomReconnectCredential(credential: RoomReconnectCredential): void {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.setItem(reconnectStorageKey(credential.roomCode), JSON.stringify(credential));
  } catch {
    /* storage unavailable */
  }
}

export function readRoomReconnectCredential(roomCode: string): RoomReconnectCredential | null {
  if (!isBrowserStorageAvailable()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(reconnectStorageKey(roomCode));

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<RoomReconnectCredential>;

    if (
      typeof parsed.playerId !== 'string' ||
      typeof parsed.roomId !== 'string' ||
      typeof parsed.roomCode !== 'string' ||
      typeof parsed.reconnectToken !== 'string' ||
      parsed.roomCode !== roomCode
    ) {
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

export function removeRoomReconnectCredential(roomCode: string): void {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.removeItem(reconnectStorageKey(roomCode));
  } catch {
    /* storage unavailable */
  }
}

export function findRoomReconnectCredential(roomCode?: string | null): RoomReconnectCredential | null {
  if (!roomCode) {
    return null;
  }

  return readRoomReconnectCredential(roomCode.trim());
}
