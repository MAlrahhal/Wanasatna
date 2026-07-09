import type { PlayerStatus } from './enums.js';

export type RoomPlayerData = {
  id: string;
  name: string;
  status: PlayerStatus;
  isSpectator: boolean;
  isHost: boolean;
};
