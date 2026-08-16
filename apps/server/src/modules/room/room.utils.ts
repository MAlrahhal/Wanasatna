import { PlayerStatus, type Player, type Room } from '@prisma/client';
import type { Server } from 'socket.io';
import { prisma } from '../../lib/prisma.js';
import {
  MAX_ROOM_PLAYERS,
  ROOM_PLAYERS_SNAPSHOT_EVENT,
  type RoomData,
  type RoomPlayerData,
  type RoomSessionData,
} from '@wanasatna/shared';

export const ROOM_CODE_LENGTH = 6;
export const MAX_CODE_GENERATION_ATTEMPTS = 10;
export { MAX_ROOM_PLAYERS };
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

export async function loadActiveRoomPlayers(
  roomId: string,
  hostPlayerId: string,
): Promise<RoomPlayerData[]> {
  const players = await prisma.player.findMany({
    where: {
      roomId,
      status: { in: [PlayerStatus.CONNECTED, PlayerStatus.DISCONNECTED] },
    },
    orderBy: { joinedAt: 'asc' },
  });

  return players.map((entry) => mapPlayerData(entry, hostPlayerId));
}

export function mapRoomSession(
  room: Room,
  player: Player,
  players?: RoomPlayerData[],
  reconnectToken?: string,
): RoomSessionData {
  return {
    room: mapRoomData(room),
    player: mapPlayerData(player, room.hostPlayerId),
    players: players ?? [mapPlayerData(player, room.hostPlayerId)],
    ...(reconnectToken ? { reconnectToken } : {}),
  };
}

export async function broadcastRoomPlayersSnapshot(io: Server, roomId: string): Promise<void> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostPlayerId: true },
  });

  if (!room) {
    return;
  }

  const players = await loadActiveRoomPlayers(roomId, room.hostPlayerId);
  io.to(getRoomChannel(roomId)).emit(ROOM_PLAYERS_SNAPSHOT_EVENT, {
    roomId,
    players,
  });
}

export function isActivePlayerStatus(status: PlayerStatus): boolean {
  return status === PlayerStatus.CONNECTED || status === PlayerStatus.DISCONNECTED;
}
