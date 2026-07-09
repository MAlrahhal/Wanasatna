import { PlayerStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import type { HostChangedPayload, RoomActionResponse } from '../room.types.js';
import { validateKickPlayerPayload } from '../room.validators.js';
import { transferHost } from './host.service.js';
import { cleanupRoomIfEmpty } from './room-cleanup.service.js';
import {
  assertHost,
  findPlayerInRoom,
  findRoomById,
  isServiceError,
  serviceError,
} from './shared-room.service.js';

export async function leaveRoom(
  playerId: string,
  roomId: string,
): Promise<
  RoomActionResponse<{
    roomDeleted: boolean;
    hostChanged: HostChangedPayload | null;
  }>
> {
  const playerResult = await findPlayerInRoom(playerId, roomId);

  if (isServiceError(playerResult)) {
    return playerResult;
  }

  if (playerResult.status === PlayerStatus.LEFT) {
    const roomDeleted = await cleanupRoomIfEmpty(roomId);

    return {
      success: true,
      data: {
        roomDeleted,
        hostChanged: null,
      },
    };
  }

  const roomResult = await findRoomById(roomId);

  if (isServiceError(roomResult)) {
    return roomResult;
  }

  const isHost = roomResult.hostPlayerId === playerId;
  let hostChanged: HostChangedPayload | null = null;

  if (isHost) {
    hostChanged = await transferHost(roomId, playerId);
  }

  await prisma.player.update({
    where: { id: playerId },
    data: {
      status: PlayerStatus.LEFT,
      lastSeenAt: new Date(),
    },
  });

  const roomDeleted = await cleanupRoomIfEmpty(roomId);

  return {
    success: true,
    data: {
      roomDeleted,
      hostChanged,
    },
  };
}

export async function kickPlayer(
  hostPlayerId: string,
  roomId: string,
  payload: unknown,
): Promise<
  RoomActionResponse<{
    kickedPlayerId: string;
    roomDeleted: boolean;
  }>
> {
  const validation = validateKickPlayerPayload(payload);

  if (!validation.success) {
    return validation;
  }

  const { playerId: targetPlayerId } = validation.data;

  if (targetPlayerId === hostPlayerId) {
    return serviceError('CANNOT_KICK_SELF', 'Host cannot kick themselves.');
  }

  const roomResult = await findRoomById(roomId);

  if (isServiceError(roomResult)) {
    return roomResult;
  }

  const hostError = assertHost(roomResult, hostPlayerId);

  if (hostError) {
    return hostError;
  }

  const targetPlayerResult = await findPlayerInRoom(targetPlayerId, roomId);

  if (isServiceError(targetPlayerResult)) {
    return targetPlayerResult;
  }

  if (targetPlayerResult.status === PlayerStatus.LEFT) {
    return serviceError('PLAYER_NOT_FOUND', 'Player not found in this room.');
  }

  await prisma.player.update({
    where: { id: targetPlayerId },
    data: {
      status: PlayerStatus.LEFT,
      lastSeenAt: new Date(),
    },
  });

  const roomDeleted = await cleanupRoomIfEmpty(roomId);

  return {
    success: true,
    data: {
      kickedPlayerId: targetPlayerId,
      roomDeleted,
    },
  };
}

export async function handlePlayerDisconnect(
  playerId: string,
  roomId: string,
): Promise<void> {
  const playerResult = await findPlayerInRoom(playerId, roomId);

  if (isServiceError(playerResult)) {
    return;
  }

  if (playerResult.status !== PlayerStatus.CONNECTED) {
    return;
  }

  await prisma.player.update({
    where: { id: playerId },
    data: {
      status: PlayerStatus.DISCONNECTED,
      lastSeenAt: new Date(),
    },
  });
}
