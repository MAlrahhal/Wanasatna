import type { RoomPlayerData } from './player.js';

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
  reconnectToken: string;
  roomCode?: string;
  roomId?: string;
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

export type RoomPlayersSnapshotPayload = {
  players: RoomPlayerData[];
};

export type PlayerKickedPayload = {
  roomId: string;
  playerId: string;
};
