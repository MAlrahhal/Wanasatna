import { PlayerStatus, Prisma, RoomStatus } from '@prisma/client';
import type {
  AdminActionResponse,
  AdminForceCloseRoomData,
  AdminKickPlayerData,
  AdminLiveRoom,
  AdminRoomDetails,
  AdminRoomLockData,
  AdminRoomPlayer,
  AdminRoomsData,
} from '@wanasatna/shared';
import { prisma } from '../../lib/prisma.js';
import { getSocketServer } from '../../lib/socket-server.js';
import { cleanupGameShellRuntime } from '../game/game.lifecycle.js';
import { deleteGameShell, getGameShellByRoomId } from '../game/game.service.js';
import { cleanupPluginMatchState } from '../game/runtime/cleanup-plugin-match.js';
import { clearTeamsForRoom } from '../game/runtime/pregame-teams.service.js';
import {
  announceAdminRoomClosed,
  announceKickedPlayer,
  emitRoomLockedState,
} from '../room/room-socket-announce.js';
import { recordProductEvent } from '../analytics/product-event.service.js';
import { kickPlayerAsAdmin } from '../room/services/leave-room.service.js';
import { deleteRoomWithRelations } from '../room/services/room-cleanup.service.js';
import {
  isRetryableTransactionError,
  lockRoomRow,
  ROOM_TX_RETRY_LIMIT,
} from '../room/services/room-tx.js';
import { setRoomLockedAsAdmin } from '../room/services/shared-room.service.js';
import { createAdminAuditLogBestEffort } from './admin-audit.service.js';

const SEAT_STATUSES = [PlayerStatus.CONNECTED, PlayerStatus.DISCONNECTED] as const;

export const ADMIN_ROOM_NOT_FOUND_MESSAGE = 'الغرفة غير موجودة.';
export const ADMIN_PLAYER_NOT_FOUND_MESSAGE = 'اللاعب غير موجود في هذه الغرفة.';
export const ADMIN_ROOM_ACTION_FAILED = 'تعذر تنفيذ العملية.';

type AdminRoomRow = {
  id: string;
  code: string;
  createdAt: Date;
  isLocked: boolean;
  playerCap: number;
  hostPlayerId: string;
  hostPlayer: { name: string };
  players: Array<{
    id: string;
    name: string;
    status: PlayerStatus;
    isSpectator: boolean;
  }>;
};

const ROOM_DETAIL_SELECT = {
  id: true,
  code: true,
  createdAt: true,
  isLocked: true,
  playerCap: true,
  hostPlayerId: true,
  hostPlayer: { select: { name: true } },
  players: {
    where: { status: { in: [...SEAT_STATUSES] } },
    select: {
      id: true,
      name: true,
      status: true,
      isSpectator: true,
    },
  },
};

function toIso(value: Date): string {
  return value.toISOString();
}

function mapPlayers(row: AdminRoomRow): AdminRoomPlayer[] {
  return row.players.map((player) => ({
    id: player.id,
    displayName: player.name,
    status: player.status === PlayerStatus.DISCONNECTED ? 'DISCONNECTED' : 'CONNECTED',
    isSpectator: player.isSpectator,
    isHost: player.id === row.hostPlayerId,
  }));
}

function mapRoomDetails(row: AdminRoomRow): AdminRoomDetails {
  const players = mapPlayers(row);
  const connectedCount = players.filter((player) => player.status === 'CONNECTED').length;
  const disconnectedCount = players.filter((player) => player.status === 'DISCONNECTED').length;
  const spectatorCount = players.filter((player) => player.isSpectator).length;
  const shell = getGameShellByRoomId(row.id);

  const live: AdminLiveRoom = {
    id: row.id,
    code: row.code,
    createdAt: toIso(row.createdAt),
    isLocked: row.isLocked,
    playerCount: players.length,
    connectedCount,
    disconnectedCount,
    spectatorCount,
    hostDisplayName: row.hostPlayer.name,
    playerCap: row.playerCap,
    activity: shell ? 'IN_GAME' : 'LOBBY',
    gameId: shell?.gameId ?? null,
    gamePhase: shell?.phase ?? null,
  };

  return { ...live, players };
}

function cleanupClosedRoomMemory(roomId: string): void {
  const shell = getGameShellByRoomId(roomId);
  if (shell) {
    cleanupGameShellRuntime(roomId);
    cleanupPluginMatchState(roomId, shell.gameId);
    deleteGameShell(roomId);
  }
  clearTeamsForRoom(roomId);
}

function isPrismaNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

function fail(
  code: 'ROOM_NOT_FOUND' | 'PLAYER_NOT_FOUND' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR',
  message: string,
): AdminActionResponse<never> {
  return { success: false, error: { code, message } };
}

function mapRoomActionError(code: string): AdminActionResponse<never> {
  if (code === 'ROOM_NOT_FOUND') {
    return fail('ROOM_NOT_FOUND', ADMIN_ROOM_NOT_FOUND_MESSAGE);
  }
  if (code === 'PLAYER_NOT_FOUND') {
    return fail('PLAYER_NOT_FOUND', ADMIN_PLAYER_NOT_FOUND_MESSAGE);
  }
  if (code === 'VALIDATION_ERROR') {
    return fail('VALIDATION_ERROR', ADMIN_ROOM_ACTION_FAILED);
  }
  return fail('INTERNAL_ERROR', ADMIN_ROOM_ACTION_FAILED);
}

export async function listAdminRooms(): Promise<AdminRoomsData> {
  const rows = await prisma.room.findMany({
    where: { status: { not: RoomStatus.CLOSED } },
    orderBy: { createdAt: 'desc' },
    select: ROOM_DETAIL_SELECT,
  });

  return { rooms: rows.map((row) => mapRoomDetails(row)) };
}

export async function getAdminRoomById(
  roomId: string,
): Promise<AdminActionResponse<AdminRoomDetails>> {
  const row = await prisma.room.findUnique({
    where: { id: roomId },
    select: ROOM_DETAIL_SELECT,
  });

  if (!row) {
    return fail('ROOM_NOT_FOUND', ADMIN_ROOM_NOT_FOUND_MESSAGE);
  }

  return { success: true, data: mapRoomDetails(row) };
}

export async function adminLockRoom(
  roomId: string,
  adminUserId: string,
  isLocked: boolean,
  requestId?: string,
): Promise<AdminActionResponse<AdminRoomLockData>> {
  const action = isLocked ? 'ROOM_LOCK' : 'ROOM_UNLOCK';
  let roomMutationCompleted = false;
  try {
    const result = await setRoomLockedAsAdmin(roomId, isLocked);

    if (!result.success) {
      await createAdminAuditLogBestEffort({
        actorUserId: adminUserId,
        action,
        targetId: roomId,
        outcome: 'FAILURE',
        requestId,
        metadata: { isLocked },
      });
      return mapRoomActionError(result.error.code);
    }

    roomMutationCompleted = true;
    await createAdminAuditLogBestEffort({
      actorUserId: adminUserId,
      action,
      targetId: roomId,
      outcome: 'SUCCESS',
      requestId,
      metadata: { isLocked: result.data.isLocked },
    });

    const io = getSocketServer();
    if (io) {
      emitRoomLockedState(io, result.data);
    }

    return {
      success: true,
      data: {
        roomId: result.data.roomId,
        isLocked: result.data.isLocked,
      },
    };
  } catch (error) {
    if (!roomMutationCompleted) {
      await createAdminAuditLogBestEffort({
        actorUserId: adminUserId,
        action,
        targetId: roomId,
        outcome: 'FAILURE',
        requestId,
        metadata: { isLocked },
      });
    }
    throw error;
  }
}

export async function adminKickPlayer(
  roomId: string,
  playerId: string,
  adminUserId: string,
  requestId?: string,
): Promise<AdminActionResponse<AdminKickPlayerData>> {
  let roomMutationCompleted = false;
  try {
    const result = await kickPlayerAsAdmin(roomId, playerId);

    if (!result.success) {
      await createAdminAuditLogBestEffort({
        actorUserId: adminUserId,
        action: 'ROOM_KICK',
        targetId: roomId,
        outcome: 'FAILURE',
        requestId,
        metadata: { playerId },
      });
      return mapRoomActionError(result.error.code);
    }

    roomMutationCompleted = true;
    await createAdminAuditLogBestEffort({
      actorUserId: adminUserId,
      action: 'ROOM_KICK',
      targetId: roomId,
      outcome: 'SUCCESS',
      requestId,
      metadata: {
        playerId: result.data.kickedPlayerId,
        roomDeleted: result.data.roomDeleted,
      },
    });

    const io = getSocketServer();
    if (io) {
      await announceKickedPlayer(io, roomId, result.data.kickedPlayerId, result.data.roomDeleted);
    } else if (result.data.roomDeleted) {
      cleanupClosedRoomMemory(roomId);
    }

    return {
      success: true,
      data: {
        roomId,
        playerId: result.data.kickedPlayerId,
        roomDeleted: result.data.roomDeleted,
      },
    };
  } catch (error) {
    if (!roomMutationCompleted) {
      await createAdminAuditLogBestEffort({
        actorUserId: adminUserId,
        action: 'ROOM_KICK',
        targetId: roomId,
        outcome: 'FAILURE',
        requestId,
        metadata: { playerId },
      });
    }
    throw error;
  }
}

export async function adminForceCloseRoom(
  roomId: string,
  adminUserId: string,
  requestId?: string,
): Promise<AdminActionResponse<AdminForceCloseRoomData>> {
  let lastError: unknown;
  let roomOperationCompleted = false;

  for (let attempt = 0; attempt < ROOM_TX_RETRY_LIMIT; attempt += 1) {
    try {
      const outcome = await prisma.$transaction(async (tx) => {
        const locked = await lockRoomRow(tx, roomId);
        if (!locked) {
          return { alreadyClosed: true };
        }

        const room = await tx.room.findUnique({
          where: { id: roomId },
          select: { id: true },
        });

        if (!room) {
          return { alreadyClosed: true };
        }

        await deleteRoomWithRelations(roomId, tx);
        return { alreadyClosed: false };
      });

      roomOperationCompleted = true;
      await createAdminAuditLogBestEffort({
        actorUserId: adminUserId,
        action: 'ROOM_FORCE_CLOSE',
        targetId: roomId,
        outcome: 'SUCCESS',
        requestId,
        metadata: { alreadyClosed: outcome.alreadyClosed },
      });

      const io = getSocketServer();
      if (io) {
        await announceAdminRoomClosed(io, roomId);
      } else {
        cleanupClosedRoomMemory(roomId);
      }

      if (!outcome.alreadyClosed) {
        await recordProductEvent({
          type: 'ROOM_CLOSED',
          roomId,
        });
      }

      return {
        success: true,
        data: {
          roomId,
          alreadyClosed: outcome.alreadyClosed,
        },
      };
    } catch (error) {
      lastError = error;
      if (isPrismaNotFound(error)) {
        roomOperationCompleted = true;
        await createAdminAuditLogBestEffort({
          actorUserId: adminUserId,
          action: 'ROOM_FORCE_CLOSE',
          targetId: roomId,
          outcome: 'SUCCESS',
          requestId,
          metadata: { alreadyClosed: true },
        });

        const io = getSocketServer();
        if (io) {
          await announceAdminRoomClosed(io, roomId);
        } else {
          cleanupClosedRoomMemory(roomId);
        }

        return {
          success: true,
          data: {
            roomId,
            alreadyClosed: true,
          },
        };
      }

      if (!isRetryableTransactionError(error) || attempt === ROOM_TX_RETRY_LIMIT - 1) {
        if (!roomOperationCompleted) {
          await createAdminAuditLogBestEffort({
            actorUserId: adminUserId,
            action: 'ROOM_FORCE_CLOSE',
            targetId: roomId,
            outcome: 'FAILURE',
            requestId,
          });
        }
        throw error;
      }
    }
  }

  await createAdminAuditLogBestEffort({
    actorUserId: adminUserId,
    action: 'ROOM_FORCE_CLOSE',
    targetId: roomId,
    outcome: 'FAILURE',
    requestId,
  });
  throw lastError;
}
