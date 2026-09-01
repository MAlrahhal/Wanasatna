import { PlayerStatus, Prisma, RoomCloseReason } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { abortAllActiveMatches } from '../../match/match-history.service.js';
import { deleteRoomWithRelations } from './room-cleanup.service.js';
import { ensureDurableHistoryForAllLiveRooms } from './room-history-write.service.js';

export type RoomStartupReconciliationSummary = {
  roomHistoriesEnsured: number;
  connectedSeatsReconciled: number;
  orphanRoomsRemoved: number;
  activeMatchesAborted: number;
};

/**
 * Single-replica assumption: a new process owns zero live sockets, so every
 * persisted CONNECTED seat from the previous process is stale.
 * Revisit this before running multiple simultaneous server replicas.
 */
export async function reconcileStaleConnectedPlayers(
  reconciledAt: Date = new Date(),
): Promise<number> {
  const updated = await prisma.player.updateMany({
    where: { status: PlayerStatus.CONNECTED },
    data: {
      status: PlayerStatus.DISCONNECTED,
      lastSeenAt: reconciledAt,
    },
  });

  return updated.count;
}

export async function deleteOrphanRooms(): Promise<number> {
  const orphanRooms = await prisma.room.findMany({
    where: {
      players: {
        none: {
          status: {
            in: [PlayerStatus.CONNECTED, PlayerStatus.DISCONNECTED],
          },
        },
      },
    },
    select: { id: true },
  });

  let removed = 0;

  for (const room of orphanRooms) {
    try {
      await deleteRoomWithRelations(room.id, prisma, RoomCloseReason.STARTUP_RECONCILIATION);
      removed += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        continue;
      }
      throw error;
    }
  }

  return removed;
}

export async function reconcilePersistedRoomLifecycle(): Promise<RoomStartupReconciliationSummary> {
  const roomHistoriesEnsured = await ensureDurableHistoryForAllLiveRooms();
  const activeMatchesAborted = await abortAllActiveMatches();
  const connectedSeatsReconciled = await reconcileStaleConnectedPlayers();
  const orphanRoomsRemoved = await deleteOrphanRooms();

  console.info('[room-lifecycle]', {
    stage: 'startup-reconciliation',
    roomHistoriesEnsured,
    activeMatchesAborted,
    connectedSeatsReconciled,
    orphanRoomsRemoved,
  });

  return {
    roomHistoriesEnsured,
    activeMatchesAborted,
    connectedSeatsReconciled,
    orphanRoomsRemoved,
  };
}
