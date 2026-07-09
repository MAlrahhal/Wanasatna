import type { RoomError } from './errors.js';
import type { HostChangedPayload } from './payloads.js';
import type { RoomSessionData } from './room.js';

export type RoomSuccessResponse<T> = {
  success: true;
  data: T;
};

export type RoomErrorResponse = {
  success: false;
  error: RoomError;
};

export type RoomActionResponse<T> = RoomSuccessResponse<T> | RoomErrorResponse;

export type CreateRoomResponse = RoomActionResponse<RoomSessionData>;

export type ReconnectResponse = RoomActionResponse<RoomSessionData> & {
  hostChanged?: HostChangedPayload | null;
};
