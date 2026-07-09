export type PlayerStatus = 'CONNECTED' | 'DISCONNECTED' | 'LEFT';

export type RoomStatus = 'LOBBY' | 'PLAYING' | 'CLOSED';

export type SessionType = 'SINGLE_GAME' | 'MARATHON';

export type RoomErrorCode =
  | 'VALIDATION_ERROR'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_CLOSED'
  | 'ROOM_LOCKED'
  | 'ROOM_FULL'
  | 'PLAYER_ALREADY_EXISTS'
  | 'PLAYER_NOT_FOUND'
  | 'NOT_HOST'
  | 'CANNOT_KICK_SELF'
  | 'RECONNECT_EXPIRED'
  | 'ROOM_CODE_GENERATION_FAILED'
  | 'INTERNAL_ERROR';

export type RoomError = {
  code: RoomErrorCode;
  message: string;
};

export type RoomActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: RoomError };

export type RoomPlayerData = {
  id: string;
  name: string;
  status: PlayerStatus;
  isSpectator: boolean;
  isHost: boolean;
};

export type RoomData = {
  id: string;
  code: string;
  status: RoomStatus;
  isLocked: boolean;
  sessionType: SessionType;
  activeSessionId: string | null;
  hostPlayerId: string;
  createdAt: string;
};

export type RoomSessionData = {
  room: RoomData;
  player: RoomPlayerData;
};

export type HostChangedPayload = {
  roomId: string;
  hostPlayerId: string;
  hostPlayerName: string;
};

export type RoomUpdatedPayload = {
  roomId: string;
  isLocked: boolean;
};

export type PlayerKickedPayload = {
  roomId: string;
  playerId: string;
};

export type ReconnectResponse = RoomActionResponse<RoomSessionData> & {
  hostChanged?: HostChangedPayload | null;
};
