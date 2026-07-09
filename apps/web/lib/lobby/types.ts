export type LobbyPlayer = {
  id: string;
  name: string;
  isHost: boolean;
  isSpectator: boolean;
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
