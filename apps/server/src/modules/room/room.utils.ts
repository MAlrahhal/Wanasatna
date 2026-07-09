import { PlayerStatus, type Player, type Room } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { RoomData, RoomPlayerData } from './room.types.js';

export const ROOM_CODE_LENGTH = 6;
export const MAX_CODE_GENERATION_ATTEMPTS = 10;
export const MAX_ROOM_PLAYERS = 12;
export const RECONNECT_WINDOW_MS = 3 * 60 * 1000;

export function getRoomChannel(roomId: string): string {
  return `room:${roomId}`;
}

export function getPlayerChannel(playerId: string): string {
  return `player:${playerId}`;
}

export function generateRoomCode(): string {
  const code = Math.floor(Math.random() * 1_000_000);
  return code.toString().padStart(ROOM_CODE_LENGTH, '0');
}

export async function generateUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const code = generateRoomCode();
    const existingRoom = await prisma.room.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!existingRoom) {
      return code;
    }
  }

  throw new Error('ROOM_CODE_GENERATION_FAILED');
}

export function isReconnectExpired(lastSeenAt: Date): boolean {
  return Date.now() - lastSeenAt.getTime() > RECONNECT_WINDOW_MS;
}

export function mapRoomData(room: Room): RoomData {
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    isLocked: room.isLocked,
    sessionType: room.sessionType,
    activeSessionId: room.activeSessionId,
    hostPlayerId: room.hostPlayerId,
    createdAt: room.createdAt,
  };
}

export function mapPlayerData(player: Player, hostPlayerId: string): RoomPlayerData {
  return {
    id: player.id,
    name: player.name,
    status: player.status,
    isSpectator: player.isSpectator,
    isHost: player.id === hostPlayerId,
  };
}

export function mapRoomSession(room: Room, player: Player): {
  room: RoomData;
  player: RoomPlayerData;
} {
  return {
    room: mapRoomData(room),
    player: mapPlayerData(player, room.hostPlayerId),
  };
}

export function isActivePlayerStatus(status: PlayerStatus): boolean {
  return status === PlayerStatus.CONNECTED || status === PlayerStatus.DISCONNECTED;
}
