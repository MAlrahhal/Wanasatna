import type { Server } from 'socket.io';
import { MatchStatus } from '@prisma/client';
import type { GameShellState } from '@wanasatna/shared';
import { prisma } from '../../../lib/prisma.js';
import { opsLogger } from '../../../lib/ops-logger.js';
import { isMarathonParticipationLocked } from '../../marathon/marathon.store.js';
import {
  findActivePersistedMatchId,
  getKnownActivePersistedMatchId,
} from '../../match/match-history.service.js';
import { broadcastRoomPlayersSnapshot } from '../../room/room.utils.js';
import { getGameShellByRoomId, promoteConnectedSpectatorsIntoMatch } from '../game.service.js';
import { broadcastGameShellState } from '../game.timer.js';

export type MatchRosterFields = {
  playerIds: string[];
  playerNames: Record<string, string>;
  scores: Record<string, number>;
};

type PromotionPersistenceInput = {
  roomId: string;
  matchId: string | null;
  absorbedPlayerIds: string[];
};

type PromotionPersistenceOverride = (input: PromotionPersistenceInput) => Promise<void>;

const pendingPromotionByRoomId = new Map<string, Promise<void>>();
let promotionPersistenceOverrideForTests: PromotionPersistenceOverride | null = null;

export function expandMatchRoster<T extends MatchRosterFields>(
  match: T,
  shell: GameShellState,
  absorbedPlayerIds: readonly string[],
): T {
  if (absorbedPlayerIds.length === 0) {
    return match;
  }

  const playerIds = [...match.playerIds];
  const playerNames = { ...match.playerNames };
  const scores = { ...match.scores };
  const known = new Set(playerIds);

  for (const playerId of absorbedPlayerIds) {
    if (known.has(playerId)) {
      continue;
    }
    known.add(playerId);
    playerIds.push(playerId);
    const player = shell.players.find((entry) => entry.id === playerId);
    playerNames[playerId] = player?.name ?? 'لاعب';
    scores[playerId] = scores[playerId] ?? 0;
  }

  return { ...match, playerIds, playerNames, scores };
}

async function persistPromotedSpectators(
  io: Server,
  input: PromotionPersistenceInput,
): Promise<void> {
  const { roomId, matchId, absorbedPlayerIds } = input;
  const uniquePlayerIds = [...new Set(absorbedPlayerIds)];
  let rosterChanged = false;

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.player.updateMany({
        where: { roomId, id: { in: uniquePlayerIds } },
        data: { isSpectator: false },
      });
      rosterChanged = updated.count > 0;

      if (!matchId) {
        opsLogger.warn(
          'spectator-promote-persist-skipped',
          'تعذر ربط ترقية المتفرج بمباراة نشطة محفوظة.',
          { operation: 'promote-spectators-next-round', stage: 'match-not-found', roomId },
        );
        return;
      }

      const match = await tx.match.findFirst({
        where: { id: matchId, roomId, status: MatchStatus.ACTIVE },
        select: { id: true },
      });

      if (!match) {
        opsLogger.warn(
          'spectator-promote-persist-skipped',
          'انتهت المباراة قبل حفظ ترقية المتفرج.',
          { operation: 'promote-spectators-next-round', stage: 'match-no-longer-active', roomId },
        );
        return;
      }

      const existing = await tx.matchParticipant.findMany({
        where: { matchId: match.id, playerId: { in: uniquePlayerIds } },
        select: { playerId: true },
      });
      const alreadyPresent = new Set(existing.map((row) => row.playerId));
      const players = await tx.player.findMany({
        where: { roomId, id: { in: uniquePlayerIds } },
        select: { id: true, name: true, userId: true },
      });
      const rows = players
        .filter((player) => !alreadyPresent.has(player.id))
        .map((player) => ({
          matchId: match.id,
          playerId: player.id,
          userId: player.userId,
          displayName: player.name,
        }));

      if (rows.length > 0) {
        // The schema has no (matchId, playerId) unique constraint. The per-room queue below
        // serializes same-process promotion writes; this existence check makes retries idempotent.
        await tx.matchParticipant.createMany({ data: rows });
      }
    });

    if (rosterChanged) {
      await broadcastRoomPlayersSnapshot(io, roomId);
    }
  } catch (error) {
    opsLogger.warn('spectator-promote-persist-failed', 'تعذر حفظ ترقية المتفرج للجولة التالية.', {
      operation: 'promote-spectators-next-round',
      stage: 'persist-failed',
      roomId,
      errorName: error instanceof Error ? error.name : typeof error,
    });
  }
}

function queuePromotionPersistence(
  io: Server,
  roomId: string,
  absorbedPlayerIds: string[],
): Promise<void> {
  const previous = pendingPromotionByRoomId.get(roomId);
  // Capture the match established at countdown when available. After a process restart, resolve
  // the current active row immediately before any later completion/abort can run.
  const capturedMatchId = getKnownActivePersistedMatchId(roomId);
  const matchIdPromise =
    promotionPersistenceOverrideForTests || capturedMatchId
      ? Promise.resolve(capturedMatchId)
      : findActivePersistedMatchId(roomId);

  const uniquePlayerIds = [...new Set(absorbedPlayerIds)];
  const pending = (async () => {
    const matchId = await matchIdPromise;
    await previous;

    const input = { roomId, matchId, absorbedPlayerIds: uniquePlayerIds };
    if (promotionPersistenceOverrideForTests) {
      await promotionPersistenceOverrideForTests(input);
      return;
    }

    await persistPromotedSpectators(io, input);
  })().catch((error) => {
    opsLogger.warn('spectator-promote-persist-failed', 'تعذر حفظ ترقية المتفرج للجولة التالية.', {
      operation: 'promote-spectators-next-round',
      stage: 'queue-failed',
      roomId,
      errorName: error instanceof Error ? error.name : typeof error,
    });
  });

  pendingPromotionByRoomId.set(roomId, pending);
  void pending.finally(() => {
    if (pendingPromotionByRoomId.get(roomId) === pending) {
      pendingPromotionByRoomId.delete(roomId);
    }
  });
  return pending;
}

/** Wait for all promotion writes registered for the current room match. */
export async function waitForPendingSpectatorPromotionPersistence(roomId: string): Promise<void> {
  await pendingPromotionByRoomId.get(roomId);
}

/** Test-only seam: keeps promotion unit tests independent from Prisma/network writes. */
export function setSpectatorPromotionPersistenceForTests(
  override: PromotionPersistenceOverride | null,
): void {
  promotionPersistenceOverrideForTests = override;
}

/** Test-only cleanup for isolated unit-test rooms. */
export function clearPendingSpectatorPromotionPersistenceForTests(roomId?: string): void {
  if (roomId) {
    pendingPromotionByRoomId.delete(roomId);
    return;
  }
  pendingPromotionByRoomId.clear();
}

/**
 * Current-round spectators become normal match players when the next round starts.
 * Skips marathon-locked rooms. Guessing Challenge must not call this (fixed teams).
 */
export function absorbSpectatorsAndExpandMatch<T extends MatchRosterFields>(
  io: Server,
  roomId: string,
  match: T,
): { match: T; shell: GameShellState | null; absorbedPlayerIds: string[] } {
  const currentShell = getGameShellByRoomId(roomId);
  if (!currentShell || isMarathonParticipationLocked(roomId)) {
    return { match, shell: currentShell, absorbedPlayerIds: [] };
  }

  const promoted = promoteConnectedSpectatorsIntoMatch(roomId);
  const shell = promoted.shell ?? currentShell;
  const absorbedPlayerIds = promoted.absorbedPlayerIds;

  if (absorbedPlayerIds.length > 0 && promoted.shell) {
    broadcastGameShellState(io, promoted.shell);
    void queuePromotionPersistence(io, roomId, absorbedPlayerIds);
  }

  return {
    match: expandMatchRoster(match, shell, absorbedPlayerIds),
    shell,
    absorbedPlayerIds,
  };
}
