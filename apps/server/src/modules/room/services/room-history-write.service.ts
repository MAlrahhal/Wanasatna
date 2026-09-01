import { randomUUID } from 'node:crypto';
import { PlayerStatus, RoomCloseReason, type Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';

export type CreateRoomHistoryInput = {
  historyId: string;
  roomId: string;
  roomCode: string;
  hostPlayerId: string;
  hostDisplayName: string;
  playerCap: number;
  createdByAdmin: boolean;
  createdAt: Date;
};

export type RecordRoomParticipationInput = {
  historyId: string;
  playerId: string;
  displayName: string;
  joinedAt: Date;
  joinedAsSpectator: boolean;
  wasHost?: boolean;
};

/** Create complete history for a newly-created Room inside the Room transaction. */
export async function createDurableRoomHistory(
  tx: Prisma.TransactionClient,
  input: CreateRoomHistoryInput,
): Promise<void> {
  await tx.roomHistory.create({
    data: {
      id: input.historyId,
      liveRoomId: input.roomId,
      roomCode: input.roomCode,
      originalHostName: input.hostDisplayName,
      currentHostPlayerId: input.hostPlayerId,
      currentHostName: input.hostDisplayName,
      playerCap: input.playerCap,
      isLocked: false,
      wasEverLocked: false,
      createdByAdmin: input.createdByAdmin,
      isComplete: true,
      createdAt: input.createdAt,
      historyStartedAt: input.createdAt,
      participations: {
        create: {
          id: randomUUID(),
          livePlayerId: input.hostPlayerId,
          displayName: input.hostDisplayName,
          joinedAt: input.createdAt,
          joinedAsSpectator: false,
          wasHost: true,
        },
      },
      hostChanges: {
        create: {
          id: randomUUID(),
          livePlayerId: input.hostPlayerId,
          displayName: input.hostDisplayName,
          assignedAt: input.createdAt,
        },
      },
    },
  });
}

/**
 * Attach partial coverage to a Room that already existed when this feature started.
 * Unknown pre-coverage facts remain null and `isComplete` remains false.
 */
export async function ensureDurableRoomHistoryForLiveRoom(
  tx: Prisma.TransactionClient,
  roomId: string,
  historyStartedAt: Date = new Date(),
): Promise<string | null> {
  const room = await tx.room.findUnique({
    where: { id: roomId },
    include: {
      hostPlayer: { select: { id: true, name: true } },
      players: { orderBy: { joinedAt: 'asc' } },
    },
  });

  if (!room) {
    return null;
  }

  if (room.historyId) {
    return room.historyId;
  }

  const historyId = randomUUID();
  await tx.roomHistory.create({
    data: {
      id: historyId,
      liveRoomId: room.id,
      roomCode: room.code,
      originalHostName: null,
      currentHostPlayerId: room.hostPlayerId,
      currentHostName: room.hostPlayer.name,
      playerCap: room.playerCap,
      isLocked: room.isLocked,
      wasEverLocked: room.isLocked ? true : null,
      createdByAdmin: null,
      isComplete: false,
      createdAt: room.createdAt,
      historyStartedAt,
      participations: {
        create: room.players.map((player) => ({
          id: randomUUID(),
          livePlayerId: player.id,
          displayName: player.name,
          joinedAt: player.joinedAt,
          leftAt: player.status === PlayerStatus.LEFT ? player.lastSeenAt : null,
          joinedAsSpectator: null,
          wasHost: player.id === room.hostPlayerId ? true : null,
        })),
      },
      hostChanges: {
        create: {
          id: randomUUID(),
          livePlayerId: room.hostPlayer.id,
          displayName: room.hostPlayer.name,
          assignedAt: historyStartedAt,
        },
      },
    },
  });

  await tx.room.update({
    where: { id: room.id },
    data: { historyId },
  });

  return historyId;
}

export async function ensureDurableHistoryForAllLiveRooms(
  historyStartedAt: Date = new Date(),
): Promise<number> {
  const rooms = await prisma.room.findMany({
    where: { historyId: null },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  let ensured = 0;
  for (const room of rooms) {
    const historyId = await prisma.$transaction((tx) =>
      ensureDurableRoomHistoryForLiveRoom(tx, room.id, historyStartedAt),
    );
    if (historyId) {
      ensured += 1;
    }
  }

  return ensured;
}

export async function recordRoomParticipation(
  tx: Prisma.TransactionClient,
  input: RecordRoomParticipationInput,
): Promise<void> {
  await tx.roomParticipationHistory.upsert({
    where: {
      roomHistoryId_livePlayerId: {
        roomHistoryId: input.historyId,
        livePlayerId: input.playerId,
      },
    },
    create: {
      id: randomUUID(),
      roomHistoryId: input.historyId,
      livePlayerId: input.playerId,
      displayName: input.displayName,
      joinedAt: input.joinedAt,
      joinedAsSpectator: input.joinedAsSpectator,
      wasHost: input.wasHost ?? false,
    },
    update: {},
  });
}

export async function recordRoomParticipationLeft(
  tx: Prisma.TransactionClient,
  historyId: string,
  playerId: string,
  leftAt: Date,
): Promise<void> {
  await tx.roomParticipationHistory.updateMany({
    where: {
      roomHistoryId: historyId,
      livePlayerId: playerId,
      leftAt: null,
    },
    data: { leftAt },
  });
}

export async function recordRoomHostTransfer(
  tx: Prisma.TransactionClient,
  input: {
    historyId: string;
    playerId: string;
    displayName: string;
    assignedAt: Date;
  },
): Promise<void> {
  await tx.roomParticipationHistory.updateMany({
    where: {
      roomHistoryId: input.historyId,
      livePlayerId: input.playerId,
    },
    data: { wasHost: true },
  });

  await tx.roomHostHistory.upsert({
    where: {
      roomHistoryId_livePlayerId: {
        roomHistoryId: input.historyId,
        livePlayerId: input.playerId,
      },
    },
    create: {
      id: randomUUID(),
      roomHistoryId: input.historyId,
      livePlayerId: input.playerId,
      displayName: input.displayName,
      assignedAt: input.assignedAt,
    },
    update: {},
  });

  await tx.roomHistory.update({
    where: { id: input.historyId },
    data: {
      currentHostPlayerId: input.playerId,
      currentHostName: input.displayName,
    },
  });
}

export async function setDurableRoomLockState(
  tx: Prisma.TransactionClient,
  roomId: string,
  isLocked: boolean,
): Promise<void> {
  const room = await tx.room.findUnique({
    where: { id: roomId },
    select: { historyId: true },
  });
  const historyId = room?.historyId ?? (await ensureDurableRoomHistoryForLiveRoom(tx, roomId));

  if (!historyId) {
    return;
  }

  await tx.roomHistory.update({
    where: { id: historyId },
    data: {
      isLocked,
      ...(isLocked ? { wasEverLocked: true } : {}),
    },
  });
}

export async function closeDurableRoomHistory(
  tx: Prisma.TransactionClient,
  roomId: string,
  closeReason: RoomCloseReason,
  closedAt: Date,
): Promise<void> {
  const room = await tx.room.findUnique({
    where: { id: roomId },
    select: {
      historyId: true,
      hostPlayerId: true,
      hostPlayer: { select: { name: true } },
      playerCap: true,
      isLocked: true,
    },
  });

  const historyId =
    room?.historyId ?? (await ensureDurableRoomHistoryForLiveRoom(tx, roomId, closedAt));

  if (!historyId || !room) {
    return;
  }

  await tx.roomParticipationHistory.updateMany({
    where: { roomHistoryId: historyId, leftAt: null },
    data: { leftAt: closedAt },
  });

  await tx.roomHistory.updateMany({
    where: { id: historyId, closedAt: null },
    data: {
      currentHostPlayerId: room.hostPlayerId,
      currentHostName: room.hostPlayer.name,
      playerCap: room.playerCap,
      isLocked: room.isLocked,
      ...(room.isLocked ? { wasEverLocked: true } : {}),
      closedAt,
      closeReason,
    },
  });
}
