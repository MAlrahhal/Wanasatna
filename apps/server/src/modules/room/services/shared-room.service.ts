import { PlayerStatus, type Player, type Room, RoomStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import type { RoomActionResponse, RoomUpdatedPayload } from '@wanasatna/shared';
import { MAX_ROOM_PLAYERS } from '../room.utils.js';

export type ServiceError = Extract<RoomActionResponse<never>, { success: false }>;

export function serviceError(code: ServiceError['error']['code'], message: string): ServiceError {
  return {
    success: false,
    error: { code, message },
  };
}

export function isServiceError(value: ServiceError | Room | Player): value is ServiceError {
  return 'success' in value && value.success === false;
}

export async function findRoomById(roomId: string): Promise<ServiceError | Room> {
  const room = await prisma.room.findUnique({ where: { id: roomId } });

  if (!room) {
    return serviceError('ROOM_NOT_FOUND', 'Room not found.');
  }

  return room;
}

export async function findRoomByCode(code: string): Promise<ServiceError | Room> {
  const room = await prisma.room.findUnique({ where: { code } });

  if (!room) {
    return serviceError('ROOM_NOT_FOUND', 'Room not found.');
  }

  return room;
}

export async function findPlayerInRoom(
  playerId: string,
  roomId: string,
): Promise<ServiceError | Player> {
  const player = await prisma.player.findFirst({
    where: {
      id: playerId,
      roomId,
    },
  });

  if (!player) {
    return serviceError('PLAYER_NOT_FOUND', 'Player not found in this room.');
  }

  return player;
}

export function assertRoomNotClosed(room: Room): ServiceError | null {
  if (room.status === RoomStatus.CLOSED) {
    return serviceError('ROOM_CLOSED', 'This room is closed.');
  }

  return null;
}

export function assertRoomNotLocked(room: Room): ServiceError | null {
  if (room.isLocked) {
    return serviceError('ROOM_LOCKED', 'This room is locked.');
  }

  return null;
}

export function assertHost(room: Room, playerId: string): ServiceError | null {
  if (room.hostPlayerId !== playerId) {
    return serviceError('NOT_HOST', 'Only the host can perform this action.');
  }

  return null;
}

export async function countActivePlayers(roomId: string): Promise<number> {
  return prisma.player.count({
    where: {
      roomId,
      status: {
        in: [PlayerStatus.CONNECTED, PlayerStatus.DISCONNECTED],
      },
    },
  });
}

export async function assertRoomJoinable(room: Room): Promise<ServiceError | null> {
  const closedError = assertRoomNotClosed(room);

  if (closedError) {
    return closedError;
  }

  const lockedError = assertRoomNotLocked(room);

  if (lockedError) {
    return lockedError;
  }

  const activePlayerCount = await countActivePlayers(room.id);

  if (activePlayerCount >= MAX_ROOM_PLAYERS) {
    return serviceError('ROOM_FULL', 'This room is full.');
  }

  return null;
}

async function setRoomLocked(
  hostPlayerId: string,
  roomId: string,
  isLocked: boolean,
): Promise<RoomActionResponse<RoomUpdatedPayload>> {
  const roomResult = await findRoomById(roomId);

  if (isServiceError(roomResult)) {
    return roomResult;
  }

  const hostError = assertHost(roomResult, hostPlayerId);

  if (hostError) {
    return hostError;
  }

  if (roomResult.isLocked === isLocked) {
    return {
      success: true,
      data: {
        roomId: roomResult.id,
        isLocked,
      },
    };
  }

  const updatedRoom = await prisma.room.update({
    where: { id: roomId },
    data: { isLocked },
  });

  return {
    success: true,
    data: {
      roomId: updatedRoom.id,
      isLocked: updatedRoom.isLocked,
    },
  };
}

export async function lockRoom(
  hostPlayerId: string,
  roomId: string,
): Promise<RoomActionResponse<RoomUpdatedPayload>> {
  return setRoomLocked(hostPlayerId, roomId, true);
}

export async function unlockRoom(
  hostPlayerId: string,
  roomId: string,
): Promise<RoomActionResponse<RoomUpdatedPayload>> {
  return setRoomLocked(hostPlayerId, roomId, false);
}
