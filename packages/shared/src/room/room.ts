import type { RoomGameSettings } from '../game/admin-settings.js';
import type { RoomStatus } from './enums.js';
import type { RoomPlayerData } from './player.js';

export type RoomData = {
  id: string;
  code: string;
  status: RoomStatus;
  isLocked: boolean;
  hostPlayerId: string;
  createdAt: string | Date;
  /** Seat cap chosen at create time. Not Host-role and not a private field. */
  playerCap: number;
  /** Sanitized public Admin game overrides. Never includes who configured them. */
  gameSettings: RoomGameSettings | null;
};

export type RoomSessionData = {
  room: RoomData;
  player: RoomPlayerData;
  players: RoomPlayerData[];
  /** Opaque reconnect credential — only returned to the connecting client. */
  reconnectToken?: string;
};
