import { randomUUID } from 'node:crypto';
import { PlayerStatus, Prisma, RoomStatus, SessionType } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import type { RoomActionResponse, RoomSessionData } from '@wanasatna/shared';
import { validateCreateRoomPayload } from '../room.validators.js';
import { generateUniqueRoomCode, mapRoomSession } from '../room.utils.js';
import { generateReconnectToken, hashReconnectToken } from '../reconnect-token.js';
import { serviceError } from './shared-room.service.js';

export async function createRoom(payload: unknown): Promise<RoomActionResponse<RoomSessionData>> {
  const validation = validateCreateRoomPayload(payload);

  if (!validation.success) {
    return validation;
  }

  try {
    const code = await generateUniqueRoomCode();
    const roomId = randomUUID();
    const playerId = randomUUID();
    const reconnectToken = generateReconnectToken();
    const reconnectTokenHash = hashReconnectToken(reconnectToken);

    const room = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED');

      await tx.player.create({
        data: {
          id: playerId,
          roomId,
          name: validation.data.playerName,
          status: PlayerStatus.CONNECTED,
          isSpectator: false,
          reconnectTokenHash,
        },
      });

      return tx.room.create({
        data: {
          id: roomId,
          code,
          hostPlayerId: playerId,
          status: RoomStatus.LOBBY,
          isLocked: false,
          sessionType: SessionType.SINGLE_GAME,
        },
        include: { hostPlayer: true },
      });
    });

    return {
      success: true,
      data: mapRoomSession(room, room.hostPlayer, undefined, reconnectToken),
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'ROOM_CODE_GENERATION_FAILED') {
      return serviceError(
        'ROOM_CODE_GENERATION_FAILED',
        'Unable to generate a unique room code. Please try again.',
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return serviceError(
          'PLAYER_ALREADY_EXISTS',
          'A player with this name already exists in the room.',
        );
      }

      if (error.code === 'P2003' || error.code === 'P2010') {
        return serviceError('INTERNAL_ERROR', 'Unable to create the room. Please try again.');
      }
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return serviceError(
        'INTERNAL_ERROR',
        'Unable to connect to the database. Please try again later.',
      );
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return serviceError('INTERNAL_ERROR', 'Unable to create the room. Please try again.');
    }

    throw error;
  }
}
