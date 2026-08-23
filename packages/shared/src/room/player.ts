import type { PlayerStatus } from './enums.js';
import type { PlayerAvatarId } from './avatar.js';

export type RoomPlayerData = {
  id: string;
  name: string;
  avatarId: PlayerAvatarId;
  status: PlayerStatus;
  isSpectator: boolean;
  isHost: boolean;
};
