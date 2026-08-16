import type { RoomStatus } from './enums.js';
import type { RoomPlayerData } from './player.js';

export type RoomData = {
  id: string;
  code: string;
  status: RoomStatus;
  isLocked: boolean;
  hostPlayerId: string;
  createdAt: string | Date;
};

export type RoomSessionData = {
  room: RoomData;
  player: RoomPlayerData;
  players: RoomPlayerData[];
  /** Opaque reconnect credential — only returned to the connecting client. */
  reconnectToken?: string;
};
