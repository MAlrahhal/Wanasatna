import { PlayerStatus, Prisma } from '@prisma/client';
import type { Server } from 'socket.io';
import { HOST_CHANGED_EVENT, type HostChangedPayload } from '@wanasatna/shared';
import { prisma } from '../../../lib/prisma.js';
import { evaluatePlayerRecovery } from '../../game/runtime/player-recovery.js';
import {
  onRoomDeleted,
  onRoomPlayerRemoved,
} from '../../game/runtime/pregame-teams-room-hooks.js';
import { broadcastRoomPlayersSnapshot, getRoomChannel, RECONNECT_WINDOW_MS } from '../room.utils.js';
import { permanentlyDepartPlayer } from './permanent-departure.service.js';
import { clearPlayerAvatarId, clearRoomPlayerAvatars } from '../player-avatar.store.js';
import {
  cancelDisconnectedPlayerExpiryTimer,
  clearDisconnectedPlayerExpiryTimers,
  disconnectedPlayerExpiryNowMs,
  scheduleDisconnectedPlayerExpiryTimer,
} from './disconnected-player-expiry-timers.js';

const STARTUP_RECONCILIATION_LIMIT = 10_000;
const EXPIRY_RETRY_DELAY_MS = 30_000;

export type ExpiredDisconnectedPlayer = {
  playerId: string;
  roomId: string;
  roomDeleted: boolean;
  hostChanged: HostChangedPayload | null;
};

type PersistedDisconnectedPlayer = {
  id: string;
  roomId: string;
  lastSeenAt: Date;
};

type StartupSummary = {
  candidates: number;
  expired: number;
  scheduled: number;
};

let schedulerIo: Server | null = null;
let startupReconciled = false;
const scheduledExpiryTailByRoomId = new Map<string, Promise<void>>();

const defaultLoadPersistedDisconnectedPlayers = (): Promise<PersistedDisconnectedPlayer[]> =>
  prisma.player.findMany({
    where: { status: PlayerStatus.DISCONNECTED },
    select: { id: true, roomId: true, lastSeenAt: true },
    orderBy: { lastSeenAt: 'asc' },
    take: STARTUP_RECONCILIATION_LIMIT,
  });

let loadPersistedDisconnectedPlayers = defaultLoadPersistedDisconnectedPlayers;

function reconnectCutoff(nowMs = disconnectedPlayerExpiryNowMs()): Date {
  return new Date(nowMs - RECONNECT_WINDOW_MS);
}

function reconnectDeadlineMs(disconnectedAt: Date): number {
  // isReconnectExpired uses a strict `>` comparison, so preserve the full window.
  return disconnectedAt.getTime() + RECONNECT_WINDOW_MS + 1;
}

/**
 * Conditionally marks a DISCONNECTED player LEFT only if the persisted
 * disconnect generation still matches. Returns null when reconnect/removal won.
 */
export async function expireDisconnectedPlayer(
  playerId: string,
  roomId: string,
  expectedLastSeenAt?: Date,
): Promise<ExpiredDisconnectedPlayer | null> {
  if (
    expectedLastSeenAt &&
    disconnectedPlayerExpiryNowMs() - expectedLastSeenAt.getTime() <= RECONNECT_WINDOW_MS
  ) {
    return null;
  }

  const departed = await permanentlyDepartPlayer({
    playerId,
    roomId,
    kind: 'expiry',
    ...(expectedLastSeenAt
      ? { expectedLastSeenAt }
      : { lastSeenAtBefore: reconnectCutoff() }),
  });

  if (!departed || departed.alreadyLeft) {
    return null;
  }

  return {
    playerId,
    roomId,
    roomDeleted: departed.roomDeleted,
    hostChanged: departed.hostChanged,
  };
}

export async function announcePermanentPlayerRemoval(
  io: Server,
  roomId: string,
  playerId: string,
  result: { roomDeleted: boolean; hostChanged: HostChangedPayload | null },
): Promise<void> {
  clearPlayerAvatarId(playerId);
  if (result.roomDeleted) {
    clearRoomPlayerAvatars(roomId);
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
  expectedLastSeenAt?: Date,
): Promise<ExpiredDisconnectedPlayer | null> {
  const expired = await expireDisconnectedPlayer(playerId, roomId, expectedLastSeenAt);

  if (!expired) {
    return null;
  }

  await announcePermanentPlayerRemoval(io, roomId, playerId, expired);
  return expired;
}

let processExpiry = expireAndAnnounceDisconnectedPlayer;

function reportCandidateFailure(error: unknown): void {
  const prismaCode =
    error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  console.error('[disconnected-expiry]', {
    stage: 'candidate-failed',
    prismaCode,
    errorName: error instanceof Error ? error.name : typeof error,
  });
}

async function processScheduledExpiry(
  io: Server,
  playerId: string,
  roomId: string,
  disconnectedAt: Date,
): Promise<void> {
  try {
    await processExpiry(io, playerId, roomId, disconnectedAt);
  } catch (error) {
    reportCandidateFailure(error);
    scheduleDisconnectedPlayerExpiryAt(
      playerId,
      roomId,
      disconnectedAt,
      disconnectedPlayerExpiryNowMs() + EXPIRY_RETRY_DELAY_MS,
    );
  }
}

function enqueueScheduledExpiry(
  io: Server,
  playerId: string,
  roomId: string,
  disconnectedAt: Date,
): Promise<void> {
  const previous = scheduledExpiryTailByRoomId.get(roomId) ?? Promise.resolve();
  const queued = previous.then(() => processScheduledExpiry(io, playerId, roomId, disconnectedAt));
  scheduledExpiryTailByRoomId.set(roomId, queued);
  void queued.finally(() => {
    if (scheduledExpiryTailByRoomId.get(roomId) === queued) {
      scheduledExpiryTailByRoomId.delete(roomId);
    }
  });
  return queued;
}

export function scheduleDisconnectedPlayerExpiry(
  playerId: string,
  roomId: string,
  disconnectedAt: Date,
): void {
  scheduleDisconnectedPlayerExpiryAt(
    playerId,
    roomId,
    disconnectedAt,
    reconnectDeadlineMs(disconnectedAt),
  );
}

function scheduleDisconnectedPlayerExpiryAt(
  playerId: string,
  roomId: string,
  disconnectedAt: Date,
  deadlineAtMs: number,
): void {
  const io = schedulerIo;
  if (!io) {
    return;
  }

  scheduleDisconnectedPlayerExpiryTimer({
    playerId,
    roomId,
    disconnectedAt,
    deadlineAtMs,
    onExpire: () => enqueueScheduledExpiry(io, playerId, roomId, disconnectedAt),
  });
}

export function cancelDisconnectedPlayerExpiry(playerId: string): boolean {
  return cancelDisconnectedPlayerExpiryTimer(playerId);
}

/** One bounded startup query restores timers after a deploy/restart. */
export async function startDisconnectedPlayerExpiryScheduler(io: Server): Promise<StartupSummary> {
  if (startupReconciled) {
    return { candidates: 0, expired: 0, scheduled: 0 };
  }

  schedulerIo = io;
  startupReconciled = true;

  try {
    const candidates = await loadPersistedDisconnectedPlayers();
    const nowMs = disconnectedPlayerExpiryNowMs();
    let expired = 0;
    let scheduled = 0;

    for (const candidate of candidates) {
      if (nowMs > candidate.lastSeenAt.getTime() + RECONNECT_WINDOW_MS) {
        try {
          const result = await processExpiry(
            io,
            candidate.id,
            candidate.roomId,
            candidate.lastSeenAt,
          );
          if (result) {
            expired += 1;
          }
        } catch (error) {
          reportCandidateFailure(error);
          scheduleDisconnectedPlayerExpiryAt(
            candidate.id,
            candidate.roomId,
            candidate.lastSeenAt,
            disconnectedPlayerExpiryNowMs() + EXPIRY_RETRY_DELAY_MS,
          );
          scheduled += 1;
        }
        continue;
      }

      scheduleDisconnectedPlayerExpiry(candidate.id, candidate.roomId, candidate.lastSeenAt);
      scheduled += 1;
    }

    if (candidates.length === STARTUP_RECONCILIATION_LIMIT) {
      console.warn('[disconnected-expiry]', {
        stage: 'startup-reconciliation-limit-reached',
        limit: STARTUP_RECONCILIATION_LIMIT,
      });
    }

    return { candidates: candidates.length, expired, scheduled };
  } catch (error) {
    schedulerIo = null;
    startupReconciled = false;
    clearDisconnectedPlayerExpiryTimers();
    throw error;
  }
}

export function stopDisconnectedPlayerExpiryScheduler(): void {
  clearDisconnectedPlayerExpiryTimers();
  schedulerIo = null;
  startupReconciled = false;
}

// Kept for existing test teardown callers while the implementation is no longer a sweep.
export const stopDisconnectedPlayerExpirySweep = stopDisconnectedPlayerExpiryScheduler;

export function setDisconnectedPlayerExpiryDependenciesForTests(input: {
  loadPersisted?: (() => Promise<PersistedDisconnectedPlayer[]>) | null;
  process?: typeof expireAndAnnounceDisconnectedPlayer | null;
}): void {
  loadPersistedDisconnectedPlayers = input.loadPersisted ?? defaultLoadPersistedDisconnectedPlayers;
  processExpiry = input.process ?? expireAndAnnounceDisconnectedPlayer;
}
