import { PlayerStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import type { HostChangedPayload, RoomActionResponse } from '@wanasatna/shared';
import { validateKickPlayerPayload } from '../room.validators.js';
import { permanentlyDepartPlayer } from './permanent-departure.service.js';
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
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true },
    });

    if (!room) {
      return {
        success: true,
        data: {
          roomDeleted: true,
          hostChanged: null,
        },
      };
    }

    return playerResult;
  }

  const departed = await permanentlyDepartPlayer({
    playerId,
    roomId,
    kind: 'leave',
  });

  if (!departed) {
    return serviceError('PLAYER_NOT_FOUND', 'Player not found in this room.');
  }

  return {
    success: true,
    data: {
      roomDeleted: departed.roomDeleted,
      hostChanged: departed.hostChanged,
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

  const departed = await permanentlyDepartPlayer({
    playerId: targetPlayerId,
    roomId,
    kind: 'kick',
  });

  if (!departed || departed.alreadyLeft) {
    return serviceError('PLAYER_NOT_FOUND', 'Player not found in this room.');
  }

  return {
    success: true,
    data: {
      kickedPlayerId: targetPlayerId,
      roomDeleted: departed.roomDeleted,
    },
  };
}

/**
 * Admin kick — reuses `permanentlyDepartPlayer`. Admin need not be in the Room
 * and may kick the current host. Does not impersonate the Host.
 */
export async function kickPlayerAsAdmin(
  roomId: string,
  targetPlayerId: string,
): Promise<
  RoomActionResponse<{
    kickedPlayerId: string;
    roomDeleted: boolean;
  }>
> {
  if (!targetPlayerId.trim()) {
    return serviceError('VALIDATION_ERROR', 'Player id is required.');
  }

  const roomResult = await findRoomById(roomId);

  if (isServiceError(roomResult)) {
    return roomResult;
  }

  const targetPlayerResult = await findPlayerInRoom(targetPlayerId, roomId);

  if (isServiceError(targetPlayerResult)) {
    return targetPlayerResult;
  }

  if (targetPlayerResult.status === PlayerStatus.LEFT) {
    return serviceError('PLAYER_NOT_FOUND', 'Player not found in this room.');
  }

  const departed = await permanentlyDepartPlayer({
    playerId: targetPlayerId,
    roomId,
    kind: 'kick',
  });

  if (!departed || departed.alreadyLeft) {
    if (departed?.roomDeleted) {
      return {
        success: true,
        data: {
          kickedPlayerId: targetPlayerId,
          roomDeleted: true,
        },
      };
    }

    return serviceError('PLAYER_NOT_FOUND', 'Player not found in this room.');
  }

  return {
    success: true,
    data: {
      kickedPlayerId: targetPlayerId,
      roomDeleted: departed.roomDeleted,
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
