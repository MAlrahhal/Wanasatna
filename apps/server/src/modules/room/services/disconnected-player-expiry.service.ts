import { PlayerStatus, Prisma } from '@prisma/client';
import type { Server } from 'socket.io';
import { HOST_CHANGED_EVENT, type HostChangedPayload } from '@wanasatna/shared';
import { env } from '../../../config/env.js';
import { prisma } from '../../../lib/prisma.js';
import { evaluatePlayerRecovery } from '../../game/runtime/player-recovery.js';
import {
  onRoomDeleted,
  onRoomPlayerRemoved,
} from '../../game/runtime/pregame-teams-room-hooks.js';
import { broadcastRoomPlayersSnapshot, getRoomChannel, RECONNECT_WINDOW_MS } from '../room.utils.js';
import { transferHost } from './host.service.js';
import { cleanupRoomIfEmpty } from './room-cleanup.service.js';

function expiryIntervalMs(): number {
  return env.testMode ? 200 : 15_000;
}

export const DISCONNECTED_PLAYER_EXPIRY_INTERVAL_MS = expiryIntervalMs();
const EXPIRY_BATCH_SIZE = 50;

export type ExpiredDisconnectedPlayer = {
  playerId: string;
  roomId: string;
  roomDeleted: boolean;
  hostChanged: HostChangedPayload | null;
};

let sweepIntervalId: ReturnType<typeof setInterval> | null = null;
let sweepInFlight = false;

function reconnectCutoff(nowMs = Date.now()): Date {
  return new Date(nowMs - RECONNECT_WINDOW_MS);
}

/**
 * Conditionally marks a DISCONNECTED player LEFT only if they are still
 * disconnected and past the reconnect window at mutation time.
 * Returns null when a reconnect (or a prior expiry) won the race.
 */
export async function expireDisconnectedPlayer(
  playerId: string,
  roomId: string,
): Promise<ExpiredDisconnectedPlayer | null> {
  const cutoff = reconnectCutoff();

  const updated = await prisma.player.updateMany({
    where: {
      id: playerId,
      roomId,
      status: PlayerStatus.DISCONNECTED,
      lastSeenAt: { lt: cutoff },
    },
    data: {
      status: PlayerStatus.LEFT,
      reconnectTokenHash: null,
      lastSeenAt: new Date(),
    },
  });

  if (updated.count !== 1) {
    return null;
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostPlayerId: true },
  });

  if (!room) {
    return {
      playerId,
      roomId,
      roomDeleted: true,
      hostChanged: null,
    };
  }

  let hostChanged: HostChangedPayload | null = null;
  let roomDeleted = false;

  try {
    if (room.hostPlayerId === playerId) {
      hostChanged = await transferHost(roomId, playerId);
    }

    roomDeleted = await cleanupRoomIfEmpty(roomId);
  } catch (error) {
    const prismaCode =
      error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
    console.error('[disconnected-expiry]', {
      stage: 'post-left-failed',
      roomId,
      prismaCode,
      errorName: error instanceof Error ? error.name : typeof error,
    });
  }

  return {
    playerId,
    roomId,
    roomDeleted,
    hostChanged,
  };
}

export async function announcePermanentPlayerRemoval(
  io: Server,
  roomId: string,
  playerId: string,
  result: { roomDeleted: boolean; hostChanged: HostChangedPayload | null },
): Promise<void> {
  if (result.roomDeleted) {
    onRoomDeleted(io, roomId);
    return;
  }

  if (result.hostChanged) {
    io.to(getRoomChannel(roomId)).emit(HOST_CHANGED_EVENT, result.hostChanged);
  }

  await broadcastRoomPlayersSnapshot(io, roomId);
  await onRoomPlayerRemoved(io, roomId, playerId, false);
  await evaluatePlayerRecovery(io, roomId);
}

export async function expireAndAnnounceDisconnectedPlayer(
  io: Server,
  playerId: string,
  roomId: string,
): Promise<ExpiredDisconnectedPlayer | null> {
  const expired = await expireDisconnectedPlayer(playerId, roomId);

  if (!expired) {
    return null;
  }

  await announcePermanentPlayerRemoval(io, roomId, playerId, expired);
  return expired;
}

export async function runDisconnectedPlayerExpirySweep(io: Server): Promise<void> {
  if (sweepInFlight) {
    return;
  }

  sweepInFlight = true;

  try {
    const candidates = await prisma.player.findMany({
      where: {
        status: PlayerStatus.DISCONNECTED,
        lastSeenAt: { lt: reconnectCutoff() },
      },
      select: { id: true, roomId: true },
      orderBy: { lastSeenAt: 'asc' },
      take: EXPIRY_BATCH_SIZE,
    });

    for (const candidate of candidates) {
      try {
        await expireAndAnnounceDisconnectedPlayer(io, candidate.id, candidate.roomId);
      } catch (error) {
        const prismaCode =
          error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
        console.error('[disconnected-expiry]', {
          stage: 'candidate-failed',
          prismaCode,
          errorName: error instanceof Error ? error.name : typeof error,
        });
      }
    }
  } catch (error) {
    const prismaCode =
      error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
    console.error('[disconnected-expiry]', {
      stage: 'sweep-failed',
      prismaCode,
      errorName: error instanceof Error ? error.name : typeof error,
    });
  } finally {
    sweepInFlight = false;
  }
}

export function startDisconnectedPlayerExpirySweep(io: Server): void {
  if (sweepIntervalId) {
    return;
  }

  const intervalMs = expiryIntervalMs();
  sweepIntervalId = setInterval(() => {
    void runDisconnectedPlayerExpirySweep(io);
  }, intervalMs);

  // Keep the timer referenced in test mode so Windows/tsx actually fires it.
  // Production HTTP listen already keeps the process alive.
  if (!env.testMode) {
    sweepIntervalId.unref();
  }
}

export function stopDisconnectedPlayerExpirySweep(): void {
  if (!sweepIntervalId) {
    return;
  }

  clearInterval(sweepIntervalId);
  sweepIntervalId = null;
  sweepInFlight = false;
}
