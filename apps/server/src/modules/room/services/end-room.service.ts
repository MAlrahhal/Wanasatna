import { Prisma, RoomCloseReason } from '@prisma/client';
import type { RoomActionResponse } from '@wanasatna/shared';
import { prisma } from '../../../lib/prisma.js';
import { deleteRoomWithRelations } from './room-cleanup.service.js';
import { isRetryableTransactionError, lockRoomRow, ROOM_TX_RETRY_LIMIT } from './room-tx.js';
import { serviceError } from './shared-room.service.js';

type EndRoomData = { roomId: string };

export async function endRoomByHost(
  roomId: string,
  playerId: string,
): Promise<RoomActionResponse<EndRoomData>> {
  let lastError: unknown;

  for (let attempt = 0; attempt < ROOM_TX_RETRY_LIMIT; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        if (!(await lockRoomRow(tx, roomId))) {
          return serviceError('ROOM_NOT_FOUND', 'Room not found.');
        }

        const room = await tx.room.findUnique({
          where: { id: roomId },
          select: { hostPlayerId: true },
        });
        if (!room) {
          return serviceError('ROOM_NOT_FOUND', 'Room not found.');
        }
        if (room.hostPlayerId !== playerId) {
          return serviceError('NOT_HOST', 'Only the current host can end the room.');
        }

        await deleteRoomWithRelations(roomId, tx, RoomCloseReason.HOST_ENDED);
        return { success: true as const, data: { roomId } };
      });
    } catch (error) {
      lastError = error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return serviceError('ROOM_NOT_FOUND', 'Room not found.');
      }
      if (!isRetryableTransactionError(error) || attempt === ROOM_TX_RETRY_LIMIT - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}
