import { prisma } from '../../../lib/prisma.js';

/** Clear current-match spectator flags for every seat in the room, including DISCONNECTED. */
export async function clearRoomSpectatorFlags(roomId: string): Promise<void> {
  await prisma.player.updateMany({
    where: { roomId, isSpectator: true },
    data: { isSpectator: false },
  });
}
