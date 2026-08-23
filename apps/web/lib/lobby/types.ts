import type { PlayerAvatarId } from '@wanasatna/shared';

export type LobbyPlayer = {
  id: string;
  name: string;
  avatarId?: PlayerAvatarId;
  isHost: boolean;
  isSpectator: boolean;
  /** Room presence: CONNECTED stays online; DISCONNECTED stays in roster offline. */
  isConnected: boolean;
};

export type LobbyRoom = {
  code: string;
  isLocked: boolean;
  players: LobbyPlayer[];
};

export type LobbyGame = {
  id: string;
  title: string;
  description: string;
  iconLabel: string;
  emoji: string;
};

export type LobbyChatMessage = {
  id: string;
  playerName: string;
  message: string;
  createdAt: string;
  isSystem?: boolean;
};

export type LobbyGameSettingsPlaceholder = {
  id: string;
  label: string;
  value: string;
};
