import type { RoomStatus, SessionType } from './enums.js';
import type { RoomPlayerData } from './player.js';

export type RoomData = {
  id: string;
  code: string;
  status: RoomStatus;
  isLocked: boolean;
  sessionType: SessionType;
  activeSessionId: string | null;
  hostPlayerId: string;
  createdAt: string | Date;
};

export type RoomSessionData = {
  room: RoomData;
  player: RoomPlayerData;
};
