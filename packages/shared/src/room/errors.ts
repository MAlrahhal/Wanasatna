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
