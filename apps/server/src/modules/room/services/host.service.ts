import { PlayerStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import type { HostChangedPayload } from '@wanasatna/shared';
import {
  ensureDurableRoomHistoryForLiveRoom,
  recordRoomHostTransfer,
} from './room-history-write.service.js';
import { lockRoomRow } from './room-tx.js';

type HostLookupDb = {
  player: Prisma.TransactionClient['player'];
};

async function findNextHostPlayer(db: HostLookupDb, roomId: string, excludePlayerId?: string) {
  for (const statuses of [[PlayerStatus.CONNECTED], [PlayerStatus.DISCONNECTED]] as const) {
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
  return prisma.$transaction(async (tx) => {
    if (!(await lockRoomRow(tx, roomId))) {
      return null;
    }

    const nextHost = await findNextHostPlayer(tx, roomId, excludePlayerId);
    if (!nextHost) {
      return null;
    }

    const historyId = await ensureDurableRoomHistoryForLiveRoom(tx, roomId);
    if (!historyId) {
      return null;
    }

    const assignedAt = new Date();
    const room = await tx.room.update({
      where: { id: roomId },
      data: { hostPlayerId: nextHost.id },
    });
    await recordRoomHostTransfer(tx, {
      historyId,
      playerId: nextHost.id,
      displayName: nextHost.name,
      assignedAt,
    });

    return {
      roomId: room.id,
      hostPlayerId: nextHost.id,
      hostPlayerName: nextHost.name,
    };
  });
}
