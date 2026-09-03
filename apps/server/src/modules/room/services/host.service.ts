import { PlayerStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import type { HostChangedPayload } from '@wanasatna/shared';
import {
  ensureDurableRoomHistoryForLiveRoom,
  recordRoomHostTransfer,
} from './room-history-write.service.js';
import { isRetryableTransactionError, lockRoomRow, ROOM_TX_RETRY_LIMIT } from './room-tx.js';

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

async function assignHostInLockedTx(
  tx: Prisma.TransactionClient,
  roomId: string,
  nextHost: { id: string; name: string },
): Promise<HostChangedPayload | null> {
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

    return assignHostInLockedTx(tx, roomId, nextHost);
  });
}

/**
 * Room-host transfer after a confirmed DISCONNECTED presence write.
 * Does not remove the player, and does not fall back to another DISCONNECTED seat.
 * No-ops if the player reconnected or is no longer the current host.
 */
export async function transferHostIfCurrentHostDisconnected(
  roomId: string,
  disconnectedPlayerId: string,
): Promise<HostChangedPayload | null> {
  let lastError: unknown;

  for (let attempt = 0; attempt < ROOM_TX_RETRY_LIMIT; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        if (!(await lockRoomRow(tx, roomId))) {
          return null;
        }

        const room = await tx.room.findUnique({
          where: { id: roomId },
          select: { hostPlayerId: true },
        });

        if (!room || room.hostPlayerId !== disconnectedPlayerId) {
          return null;
        }

        const stillDisconnectedHost = await tx.player.findFirst({
          where: {
            id: disconnectedPlayerId,
            roomId,
            status: PlayerStatus.DISCONNECTED,
          },
          select: { id: true },
        });

        if (!stillDisconnectedHost) {
          return null;
        }

        const nextHost = await findNextHostPlayer(tx, roomId, disconnectedPlayerId);
        if (!nextHost || nextHost.status !== PlayerStatus.CONNECTED || nextHost.isSpectator) {
          return null;
        }

        return assignHostInLockedTx(tx, roomId, nextHost);
      });
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === ROOM_TX_RETRY_LIMIT - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}
