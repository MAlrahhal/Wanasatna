import type { Prisma } from '@prisma/client';
import type { GameActionResponse } from '@wanasatna/shared';
import { env } from '../../../config/env.js';
import { prisma } from '../../../lib/prisma.js';
import { lockRoomRow } from '../../room/services/room-tx.js';
import { isRegisteredExperimentalGameId } from './experimental-game.registry.js';
import {
  clearExperimentalGameSelection,
  forgetExperimentalGameSelection,
  getExperimentalGameSelection,
  hydrateExperimentalGameSelection,
  persistExperimentalGameSelection,
  readPersistedExperimentalGameSelection,
  removePersistedExperimentalGameSelection,
  setExperimentalGameSelection,
} from './experimental-game-selection.store.js';
import {
  evaluateExperimentalGameAccess,
  experimentalAccessError,
  type ExperimentalAccessFacts,
  type ExperimentalAccessFailure,
  type ExperimentalGameAuthority,
} from './experimental-game-access.policy.js';

export type { ExperimentalGameAuthority } from './experimental-game-access.policy.js';

async function loadExperimentalAccessFacts(
  tx: Prisma.TransactionClient,
  input: ExperimentalGameAuthority & {
    roomId: string;
    playerId: string;
    gameId: string;
  },
): Promise<{ facts: ExperimentalAccessFacts; gameSettings: Prisma.JsonValue | null } | null> {
  const room = await tx.room.findUnique({
    where: { id: input.roomId },
    select: {
      status: true,
      hostPlayerId: true,
      gameSettings: true,
      history: { select: { createdByAdmin: true } },
      hostPlayer: {
        select: {
          userId: true,
          user: {
            select: {
              role: true,
              adminTotpCredential: { select: { enabledAt: true } },
            },
          },
        },
      },
    },
  });
  if (!room) {
    return null;
  }

  hydrateExperimentalGameSelection(input.roomId, room.gameSettings);
  return {
    facts: {
      enabled: env.experimentalGamesEnabled,
      registered: isRegisteredExperimentalGameId(input.gameId),
      accountUserId: input.accountUserId,
      accountRole: input.accountRole,
      roomCreatedByAdmin: room.history?.createdByAdmin === true,
      roomStatus: room.status,
      roomHostPlayerId: room.hostPlayerId,
      requestingPlayerId: input.playerId,
      linkedHostUserId: room.hostPlayer.userId,
      linkedHostUserRole: room.hostPlayer.user?.role ?? null,
      linkedHostAdminMfaEnabled: Boolean(room.hostPlayer.user?.adminTotpCredential?.enabledAt),
    },
    gameSettings: room.gameSettings,
  };
}

export async function selectExperimentalGameForRoom(input: {
  roomId: string;
  playerId: string;
  gameId: string;
  authority: ExperimentalGameAuthority;
  isMatchActive: () => boolean;
}): Promise<GameActionResponse<{ roomId: string; gameId: string }>> {
  const result = await prisma.$transaction(async (tx) => {
    if (!(await lockRoomRow(tx, input.roomId))) {
      return experimentalAccessError('NOT_IN_ROOM', 'Room not found.');
    }
    if (input.isMatchActive()) {
      return experimentalAccessError('INVALID_PHASE', 'The game cannot be changed during a match.');
    }

    const access = await loadExperimentalAccessFacts(tx, {
      roomId: input.roomId,
      playerId: input.playerId,
      gameId: input.gameId,
      ...input.authority,
    });
    if (!access) {
      return experimentalAccessError('NOT_IN_ROOM', 'Room not found.');
    }
    const denied = evaluateExperimentalGameAccess(access.facts);
    if (denied) {
      return denied;
    }

    const selection = {
      gameId: input.gameId,
      hostPlayerId: input.playerId,
      adminUserId: input.authority.accountUserId!,
    };
    await tx.room.update({
      where: { id: input.roomId },
      data: {
        gameSettings: persistExperimentalGameSelection(access.gameSettings, selection),
      },
    });

    return {
      success: true as const,
      data: { roomId: input.roomId, gameId: input.gameId },
    };
  });

  if (result.success) {
    setExperimentalGameSelection(input.roomId, {
      gameId: input.gameId,
      hostPlayerId: input.playerId,
      adminUserId: input.authority.accountUserId!,
    });
  }
  return result;
}

/** Caller must hold the Room row lock. */
export async function authorizeExperimentalGameStartLocked(
  tx: Prisma.TransactionClient,
  input: {
    roomId: string;
    playerId: string;
    gameId: string;
    authority: ExperimentalGameAuthority | undefined;
  },
): Promise<ExperimentalAccessFailure | null> {
  const access = await loadExperimentalAccessFacts(tx, {
    roomId: input.roomId,
    playerId: input.playerId,
    gameId: input.gameId,
    accountUserId: input.authority?.accountUserId ?? null,
    accountRole: input.authority?.accountRole ?? null,
  });
  if (!access) {
    return experimentalAccessError('NOT_IN_ROOM', 'Room not found.');
  }
  const denied = evaluateExperimentalGameAccess(access.facts);
  if (denied) {
    return denied;
  }

  const selection = getExperimentalGameSelection(input.roomId);
  if (
    !selection ||
    selection.gameId !== input.gameId ||
    selection.hostPlayerId !== input.playerId ||
    selection.adminUserId !== input.authority?.accountUserId
  ) {
    return experimentalAccessError(
      'FORBIDDEN',
      'Select this experimental game from the protected admin flow before starting it.',
    );
  }
  return null;
}

export async function preflightExperimentalGameStart(input: {
  roomId: string;
  playerId: string;
  gameId: string;
  authority: ExperimentalGameAuthority;
}): Promise<ExperimentalAccessFailure | null> {
  return prisma.$transaction(async (tx) => {
    if (!(await lockRoomRow(tx, input.roomId))) {
      return experimentalAccessError('NOT_IN_ROOM', 'Room not found.');
    }
    return authorizeExperimentalGameStartLocked(tx, input);
  });
}

/** Caller must hold the Room row lock. Consumes one-match authorization atomically. */
export async function consumeExperimentalGameSelectionLocked(
  tx: Prisma.TransactionClient,
  input: {
    roomId: string;
    playerId: string;
    gameId: string;
    adminUserId: string;
  },
): Promise<boolean> {
  const room = await tx.room.findUnique({
    where: { id: input.roomId },
    select: { gameSettings: true },
  });
  if (!room) return false;

  const selection = readPersistedExperimentalGameSelection(room.gameSettings);
  if (
    !selection ||
    selection.gameId !== input.gameId ||
    selection.hostPlayerId !== input.playerId ||
    selection.adminUserId !== input.adminUserId
  ) {
    return false;
  }

  await tx.room.update({
    where: { id: input.roomId },
    data: { gameSettings: removePersistedExperimentalGameSelection(room.gameSettings) },
  });
  return true;
}

export function forgetConsumedExperimentalGameSelection(roomId: string): void {
  forgetExperimentalGameSelection(roomId);
}

export async function clearPersistedExperimentalGameSelection(input: {
  roomId: string;
  expectedHostPlayerId?: string;
}): Promise<boolean> {
  const cleared = await prisma.$transaction(async (tx) => {
    if (!(await lockRoomRow(tx, input.roomId))) {
      return false;
    }

    const room = await tx.room.findUnique({
      where: { id: input.roomId },
      select: { gameSettings: true },
    });
    if (!room) return false;

    const persistedSelection = readPersistedExperimentalGameSelection(room.gameSettings);
    if (!persistedSelection) return false;
    if (
      input.expectedHostPlayerId &&
      persistedSelection.hostPlayerId !== input.expectedHostPlayerId
    ) {
      return false;
    }

    await tx.room.update({
      where: { id: input.roomId },
      data: { gameSettings: removePersistedExperimentalGameSelection(room.gameSettings) },
    });
    return true;
  });

  if (cleared) {
    clearExperimentalGameSelection(input.roomId);
  }
  return cleared;
}
