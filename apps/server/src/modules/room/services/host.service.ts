import { PlayerStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import type { HostChangedPayload } from '@wanasatna/shared';

type HostLookupDb = {
  player: Prisma.TransactionClient['player'];
};

async function findNextHostPlayer(
  db: HostLookupDb,
  roomId: string,
  excludePlayerId?: string,
) {
  for (const statuses of [
    [PlayerStatus.CONNECTED],
    [PlayerStatus.DISCONNECTED],
  ] as const) {
    const players = await db.player.findMany({
      where: {
        roomId,
        status: { in: [...statuses] },
        ...(excludePlayerId ? { id: { not: excludePlayerId } } : {}),
      },
      orderBy: { joinedAt: 'asc' },
    });

    const eligiblePlayer = players.find((player) => !player.isSpectator) ?? players[0];

    if (eligiblePlayer) {
      return eligiblePlayer;
    }
  }

  return null;
}

export async function selectNextHostPlayer(
  db: HostLookupDb,
  roomId: string,
  excludePlayerId?: string,
) {
  return findNextHostPlayer(db, roomId, excludePlayerId);
}

export async function transferHost(
  roomId: string,
  excludePlayerId?: string,
): Promise<HostChangedPayload | null> {
  const nextHost = await findNextHostPlayer(prisma, roomId, excludePlayerId);

  if (!nextHost) {
    return null;
  }

  const room = await prisma.room.update({
    where: { id: roomId },
    data: { hostPlayerId: nextHost.id },
  });

  return {
    roomId: room.id,
    hostPlayerId: nextHost.id,
    hostPlayerName: nextHost.name,
  };
}
