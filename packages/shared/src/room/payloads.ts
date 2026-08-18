import type { RoomGameSettings } from '../game/admin-settings.js';
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

export type UpdateRoomGameSettingsPayload = {
  gameId: string;
  settings: Record<string, number>;
};

export type RoomGameSettingsUpdatedPayload = {
  roomId: string;
  gameSettings: RoomGameSettings | null;
};

export type RoomPlayersSnapshotPayload = {
  roomId: string;
  players: RoomPlayerData[];
};

export type PlayerKickedPayload = {
  roomId: string;
  playerId: string;
};

export type RoomClosedPayload = {
  roomId: string;
  message: string;
};

export type RoomChatSendPayload = {
  content: string;
};

export type RoomChatMessage = {
  id: string;
  senderName: string;
  content: string;
  createdAt: string;
  /** Present for own-message styling only. Null after the sender row is deleted. */
  playerId: string | null;
};

export type RoomChatHistoryData = {
  messages: RoomChatMessage[];
};

export type RoomChatSendData = {
  message: RoomChatMessage;
};
