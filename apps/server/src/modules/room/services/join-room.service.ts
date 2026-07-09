import { PlayerStatus, Prisma, RoomStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import type { RoomActionResponse, RoomSessionData } from '../room.types.js';
import { validateJoinRoomPayload } from '../room.validators.js';
import { mapRoomSession } from '../room.utils.js';
import {
  assertRoomJoinable,
  findRoomByCode,
  isServiceError,
  serviceError,
} from './shared-room.service.js';

export async function joinRoom(payload: unknown): Promise<RoomActionResponse<RoomSessionData>> {
  const validation = validateJoinRoomPayload(payload);

  if (!validation.success) {
    return validation;
  }

  const roomResult = await findRoomByCode(validation.data.roomCode);

  if (isServiceError(roomResult)) {
    return roomResult;
  }

  const joinableError = await assertRoomJoinable(roomResult);

  if (joinableError) {
    return joinableError;
  }

  const existingPlayer = await prisma.player.findUnique({
    where: {
      roomId_name: {
        roomId: roomResult.id,
        name: validation.data.playerName,
      },
    },
  });

  if (existingPlayer) {
    return serviceError('PLAYER_ALREADY_EXISTS', 'A player with this name already exists in the room.');
  }

  const isSpectator = roomResult.status === RoomStatus.PLAYING;

  try {
    const player = await prisma.player.create({
      data: {
        roomId: roomResult.id,
        name: validation.data.playerName,
        status: PlayerStatus.CONNECTED,
        isSpectator,
      },
    });

    return {
      success: true,
      data: mapRoomSession(roomResult, player),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return serviceError('PLAYER_ALREADY_EXISTS', 'A player with this name already exists in the room.');
    }

    throw error;
  }
}
