import type { LobbyPlayer } from '@/lib/lobby/types';
import type { RoomPlayerData } from './types';

export function toLobbyPlayer(player: RoomPlayerData): LobbyPlayer {
  return {
    id: player.id,
    name: player.name,
    isHost: player.isHost,
    isSpectator: player.isSpectator,
  };
}

export function normalizeRoomDates<T extends { createdAt: string | Date }>(room: T): T & { createdAt: string } {
  return {
    ...room,
    createdAt: typeof room.createdAt === 'string' ? room.createdAt : room.createdAt.toISOString(),
  };
}
