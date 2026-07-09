const PLAYER_ID_KEY = 'wanasatna:playerId';
const ROOM_ID_KEY = 'wanasatna:roomId';
const PLAYER_NAME_KEY = 'wanasatna:playerName';
const ROOM_CODE_KEY = 'wanasatna:roomCode';
const SELECTED_GAME_KEY = 'wanasatna:selectedGameId';

export type RoomSession = {
  playerId: string;
  roomId: string;
  playerName: string;
  roomCode: string;
};

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
