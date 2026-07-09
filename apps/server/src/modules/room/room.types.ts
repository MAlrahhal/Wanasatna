import type { PlayerStatus, RoomStatus, SessionType } from '@prisma/client';

export const CREATE_ROOM_EVENT = 'create-room' as const;
export const JOIN_ROOM_EVENT = 'join-room' as const;
export const LEAVE_ROOM_EVENT = 'leave-room' as const;
export const KICK_PLAYER_EVENT = 'kick-player' as const;
export const LOCK_ROOM_EVENT = 'lock-room' as const;
export const UNLOCK_ROOM_EVENT = 'unlock-room' as const;
export const RECONNECT_EVENT = 'reconnect' as const;

export const HOST_CHANGED_EVENT = 'host-changed' as const;
export const ROOM_UPDATED_EVENT = 'room-updated' as const;
export const PLAYER_KICKED_EVENT = 'player-kicked' as const;

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

export type RoomSuccessResponse<T> = {
  success: true;
  data: T;
};

export type RoomErrorResponse = {
  success: false;
  error: RoomError;
};

export type RoomActionResponse<T> = RoomSuccessResponse<T> | RoomErrorResponse;

export type CreateRoomPayload = {
  playerName: string;
};

export type JoinRoomPayload = {
  roomCode: string;
  playerName: string;
};

export type KickPlayerPayload = {
  playerId: string;
};

export type ReconnectPayload = {
  playerId: string;
};

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
  createdAt: Date;
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

export type CreateRoomResponse = RoomActionResponse<RoomSessionData>;

declare module 'socket.io' {
  interface SocketData {
    playerId?: string;
    roomId?: string;
  }
}
