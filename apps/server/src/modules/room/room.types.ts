import type { PlayerStatus, RoomStatus, SessionType } from '@prisma/client';

export const CREATE_ROOM_EVENT = 'create-room' as const;

export type CreateRoomPayload = {
  playerName: string;
};

export type CreateRoomSuccessResponse = {
  success: true;
  data: CreatedRoomData;
};

export type CreateRoomErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type CreateRoomResponse = CreateRoomSuccessResponse | CreateRoomErrorResponse;

export type CreatedRoomData = {
  room: {
    id: string;
    code: string;
    status: RoomStatus;
    isLocked: boolean;
    sessionType: SessionType;
    activeSessionId: null;
    createdAt: Date;
  };
  player: {
    id: string;
    name: string;
    status: PlayerStatus;
    isSpectator: boolean;
    isHost: true;
  };
};
