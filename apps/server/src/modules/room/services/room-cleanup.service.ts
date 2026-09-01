import { MatchStatus, Prisma, RoomCloseReason } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { recordProductEvent } from '../../analytics/product-event.service.js';
import { countActivePlayers } from './shared-room.service.js';
import { closeDurableRoomHistory } from './room-history-write.service.js';
import { lockRoomRow } from './room-tx.js';

export async function deleteRoomWithRelations(
  roomId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
  closeReason: RoomCloseReason = RoomCloseReason.ROOM_EMPTY,
): Promise<void> {
  const run = async (client: Prisma.TransactionClient) => {
    const closedAt = new Date();
    await closeDurableRoomHistory(client, roomId, closeReason, closedAt);

    await client.match.updateMany({
      where: {
        roomId,
        status: MatchStatus.ACTIVE,
      },
      data: {
        status: MatchStatus.ABORTED,
        endedAt: closedAt,
      },
    });

    await client.room.delete({
      where: { id: roomId },
    });
  };

  if (db === prisma) {
    await prisma.$transaction(async (tx) => {
      await lockRoomRow(tx, roomId);
      await run(tx);
    });
    await recordProductEvent({
      type: 'ROOM_CLOSED',
      roomId,
    });
    return;
  }

  await run(db as Prisma.TransactionClient);
}

export async function cleanupRoomIfEmpty(roomId: string): Promise<boolean> {
  const activePlayerCount = await countActivePlayers(roomId);

  if (activePlayerCount > 0) {
    return false;
  }

  try {
    await deleteRoomWithRelations(roomId);
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return true;
    }
    throw error;
  }
}
