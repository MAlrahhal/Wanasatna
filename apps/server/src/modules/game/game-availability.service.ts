import type { GameAvailabilityData } from '@wanasatna/shared';
import { PLAYABLE_GAME_IDS, isPlayableGameId } from '@wanasatna/shared';
import { prisma } from '../../lib/prisma.js';
import {
  createAdminAuditLog,
  createAdminAuditLogBestEffort,
} from '../admin/admin-audit.service.js';

const enabledByGameId = new Map<string, boolean>();
let cacheReady = false;

export function invalidateGameAvailabilityCache(): void {
  cacheReady = false;
  enabledByGameId.clear();
}

async function refreshCache(): Promise<void> {
  const rows = await prisma.gameAdminConfig.findMany({
    select: { gameId: true, isEnabled: true },
  });

  enabledByGameId.clear();
  for (const gameId of PLAYABLE_GAME_IDS) {
    enabledByGameId.set(gameId, true);
  }
  for (const row of rows) {
    if (isPlayableGameId(row.gameId)) {
      enabledByGameId.set(row.gameId, row.isEnabled);
    }
  }
  cacheReady = true;
}

export async function listGameAvailability(): Promise<GameAvailabilityData> {
  if (!cacheReady) {
    await refreshCache();
  }

  return {
    games: PLAYABLE_GAME_IDS.map((gameId) => ({
      gameId,
      isEnabled: enabledByGameId.get(gameId) ?? true,
    })),
  };
}

export async function isGameEnabled(gameId: string): Promise<boolean> {
  if (!isPlayableGameId(gameId)) {
    return false;
  }

  if (!cacheReady) {
    await refreshCache();
  }

  return enabledByGameId.get(gameId) ?? true;
}

export async function resolveGameEnabledForStart(
  gameId: string,
): Promise<{ ok: true; enabled: boolean } | { ok: false }> {
  try {
    return { ok: true, enabled: await isGameEnabled(gameId) };
  } catch {
    return { ok: false };
  }
}

export async function setGameEnabled(
  gameId: string,
  isEnabled: boolean,
  auditContext?: { actorUserId: string; requestId?: string },
): Promise<{ gameId: string; isEnabled: boolean }> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.gameAdminConfig.upsert({
        where: { gameId },
        create: { gameId, isEnabled },
        update: { isEnabled },
      });
      await createAdminAuditLog(
        {
          actorUserId: auditContext?.actorUserId,
          action: 'GAME_AVAILABILITY_SET',
          targetId: gameId,
          outcome: 'SUCCESS',
          requestId: auditContext?.requestId,
          metadata: { isEnabled },
        },
        tx,
      );
    });
  } catch (error) {
    await createAdminAuditLogBestEffort({
      actorUserId: auditContext?.actorUserId,
      action: 'GAME_AVAILABILITY_SET',
      targetId: gameId,
      outcome: 'FAILURE',
      requestId: auditContext?.requestId,
      metadata: { isEnabled },
    });
    throw error;
  }

  invalidateGameAvailabilityCache();
  await refreshCache();

  return { gameId, isEnabled };
}
