import { prisma } from '../../../lib/prisma.js';
import { countActivePlayers } from './shared-room.service.js';

export async function deleteRoomWithRelations(roomId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.room.updateMany({
      where: { id: roomId },
      data: { activeSessionId: null },
    });

    await tx.room.delete({
      where: { id: roomId },
    });
  });
}

export async function cleanupRoomIfEmpty(roomId: string): Promise<boolean> {
  const activePlayerCount = await countActivePlayers(roomId);

  if (activePlayerCount > 0) {
    return false;
  }

  await deleteRoomWithRelations(roomId);
  return true;
}
