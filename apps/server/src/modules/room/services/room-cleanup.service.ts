import { MatchStatus, Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { recordProductEvent } from '../../analytics/product-event.service.js';
import { countActivePlayers } from './shared-room.service.js';

type RoomDeleteDb = {
  room: {
    delete: Prisma.TransactionClient['room']['delete'];
  };
  match: {
    updateMany: Prisma.TransactionClient['match']['updateMany'];
  };
};

export async function deleteRoomWithRelations(
  roomId: string,
  db: RoomDeleteDb = prisma,
): Promise<void> {
  const run = async (client: RoomDeleteDb) => {
    await client.match.updateMany({
      where: {
        roomId,
        status: MatchStatus.ACTIVE,
      },
      data: {
        status: MatchStatus.ABORTED,
        endedAt: new Date(),
      },
    });

    await client.room.delete({
      where: { id: roomId },
    });
  };

  if (db === prisma) {
    await prisma.$transaction(async (tx) => run(tx));
    await recordProductEvent({
      type: 'ROOM_CLOSED',
      roomId,
    });
    return;
  }

  await run(db);
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
