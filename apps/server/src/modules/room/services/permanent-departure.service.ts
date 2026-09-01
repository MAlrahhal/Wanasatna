import { PlayerStatus, Prisma } from '@prisma/client';
import type { HostChangedPayload } from '@wanasatna/shared';
import { prisma } from '../../../lib/prisma.js';
import { recordProductEvent } from '../../analytics/product-event.service.js';
import { selectNextHostPlayer } from './host.service.js';
import { deleteRoomWithRelations } from './room-cleanup.service.js';
import {
  ensureDurableRoomHistoryForLiveRoom,
  recordRoomHostTransfer,
  recordRoomParticipationLeft,
} from './room-history-write.service.js';
import { isRetryableTransactionError, lockRoomRow, ROOM_TX_RETRY_LIMIT } from './room-tx.js';

const ACTIVE_STATUSES = [PlayerStatus.CONNECTED, PlayerStatus.DISCONNECTED] as const;

export type PermanentDepartureResult = {
  playerId: string;
  roomId: string;
  alreadyLeft: boolean;
  roomDeleted: boolean;
  hostChanged: HostChangedPayload | null;
};

export type PermanentDepartureInput = {
  playerId: string;
  roomId: string;
  /**
   * `expiry` must claim a still-DISCONNECTED seat past the reconnect cutoff.
   * Leave/kick claim any remaining active seat.
   */
  kind: 'leave' | 'kick' | 'expiry';
  lastSeenAtBefore?: Date;
};

type RoomMutationDb = {
  player: Prisma.TransactionClient['player'];
  room: Prisma.TransactionClient['room'];
};

async function countActivePlayersInRoom(db: RoomMutationDb, roomId: string): Promise<number> {
  return db.player.count({
    where: {
      roomId,
      status: { in: [...ACTIVE_STATUSES] },
    },
  });
}

async function runPermanentDepartureTx(
  tx: Prisma.TransactionClient,
  input: PermanentDepartureInput,
): Promise<PermanentDepartureResult | null> {
  const { playerId, roomId, kind } = input;
  const now = new Date();

  const roomLocked = await lockRoomRow(tx, roomId);

  if (!roomLocked) {
    if (kind === 'expiry') {
      return null;
    }

    return {
      playerId,
      roomId,
      alreadyLeft: true,
      roomDeleted: true,
      hostChanged: null,
    };
  }

  const player = await tx.player.findFirst({
    where: { id: playerId, roomId },
  });

  if (!player) {
    if (kind === 'expiry') {
      return null;
    }

    return {
      playerId,
      roomId,
      alreadyLeft: true,
      roomDeleted: false,
      hostChanged: null,
    };
  }

  if (player.status === PlayerStatus.LEFT) {
    if (kind === 'expiry') {
      return null;
    }

    const activeCount = await countActivePlayersInRoom(tx, roomId);
    if (activeCount > 0) {
      return {
        playerId,
        roomId,
        alreadyLeft: true,
        roomDeleted: false,
        hostChanged: null,
      };
    }

    await deleteRoomWithRelations(roomId, tx);
    return {
      playerId,
      roomId,
      alreadyLeft: true,
      roomDeleted: true,
      hostChanged: null,
    };
  }

  const historyId = await ensureDurableRoomHistoryForLiveRoom(tx, roomId);
  if (!historyId) {
    throw new Error('ROOM_HISTORY_MISSING');
  }

  const claimWhere =
    kind === 'expiry'
      ? {
          id: playerId,
          roomId,
          status: PlayerStatus.DISCONNECTED,
          ...(input.lastSeenAtBefore ? { lastSeenAt: { lt: input.lastSeenAtBefore } } : {}),
        }
      : {
          id: playerId,
          roomId,
          status: { in: [...ACTIVE_STATUSES] },
        };

  const claimed = await tx.player.updateMany({
    where: claimWhere,
    data: {
      status: PlayerStatus.LEFT,
      reconnectTokenHash: null,
      lastSeenAt: now,
    },
  });

  if (claimed.count !== 1) {
    return kind === 'expiry'
      ? null
      : {
          playerId,
          roomId,
          alreadyLeft: true,
          roomDeleted: false,
          hostChanged: null,
        };
  }

  await recordRoomParticipationLeft(tx, historyId, playerId, now);

  const remainingActive = await countActivePlayersInRoom(tx, roomId);

  if (remainingActive === 0) {
    await deleteRoomWithRelations(roomId, tx);
    return {
      playerId,
      roomId,
      alreadyLeft: false,
      roomDeleted: true,
      hostChanged: null,
    };
  }

  const room = await tx.room.findUnique({
    where: { id: roomId },
    select: { hostPlayerId: true },
  });

  if (!room) {
    return {
      playerId,
      roomId,
      alreadyLeft: false,
      roomDeleted: true,
      hostChanged: null,
    };
  }

  let hostChanged: HostChangedPayload | null = null;

  if (room.hostPlayerId === playerId) {
    const nextHost = await selectNextHostPlayer(tx, roomId, playerId);

    if (nextHost) {
      await tx.room.update({
        where: { id: roomId },
        data: { hostPlayerId: nextHost.id },
      });
      await recordRoomHostTransfer(tx, {
        historyId,
        playerId: nextHost.id,
        displayName: nextHost.name,
        assignedAt: now,
      });
      hostChanged = {
        roomId,
        hostPlayerId: nextHost.id,
        hostPlayerName: nextHost.name,
      };
    }
  }

  return {
    playerId,
    roomId,
    alreadyLeft: false,
    roomDeleted: false,
    hostChanged,
  };
}

/**
 * Authoritative persistent departure: LEFT + host transfer, or Room delete.
 * Locks the Room row so concurrent last departures cannot commit an empty LEFT-only Room.
 */
export async function permanentlyDepartPlayer(
  input: PermanentDepartureInput,
): Promise<PermanentDepartureResult | null> {
  let lastError: unknown;

  for (let attempt = 0; attempt < ROOM_TX_RETRY_LIMIT; attempt += 1) {
    try {
      const result = await prisma.$transaction((tx) => runPermanentDepartureTx(tx, input));
      if (result?.roomDeleted) {
        await recordProductEvent({
          type: 'ROOM_CLOSED',
          roomId: result.roomId,
        });
      }
      return result;
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === ROOM_TX_RETRY_LIMIT - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}
