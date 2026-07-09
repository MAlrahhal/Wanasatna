import type { LobbyRoom } from './types';

export const mockLobbyRoom: LobbyRoom = {
  code: '482913',
  isLocked: false,
  players: [
    { id: '1', name: 'سارة', isHost: true, isSpectator: false },
    { id: '2', name: 'أحمد', isHost: false, isSpectator: false },
    { id: '3', name: 'نورة', isHost: false, isSpectator: false },
    { id: '4', name: 'خالد', isHost: false, isSpectator: true },
  ],
};
