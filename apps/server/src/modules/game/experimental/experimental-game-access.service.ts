import type { Prisma } from '@prisma/client';
import type { GameActionResponse } from '@wanasatna/shared';
import { env } from '../../../config/env.js';
import { prisma } from '../../../lib/prisma.js';
import { lockRoomRow } from '../../room/services/room-tx.js';
import { isRegisteredExperimentalGameId } from './experimental-game.registry.js';
import {
  getExperimentalGameSelection,
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
): Promise<ExperimentalAccessFacts | null> {
  const room = await tx.room.findUnique({
    where: { id: input.roomId },
    select: {
      status: true,
      hostPlayerId: true,
      history: { select: { createdByAdmin: true } },
      hostPlayer: {
        select: {
          userId: true,
          user: { select: { role: true } },
        },
      },
    },
  });
  if (!room) {
    return null;
  }

  return {
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

    const facts = await loadExperimentalAccessFacts(tx, {
      roomId: input.roomId,
      playerId: input.playerId,
      gameId: input.gameId,
      ...input.authority,
    });
    if (!facts) {
      return experimentalAccessError('NOT_IN_ROOM', 'Room not found.');
    }
    const denied = evaluateExperimentalGameAccess(facts);
    if (denied) {
      return denied;
    }

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
  const facts = await loadExperimentalAccessFacts(tx, {
    roomId: input.roomId,
    playerId: input.playerId,
    gameId: input.gameId,
    accountUserId: input.authority?.accountUserId ?? null,
    accountRole: input.authority?.accountRole ?? null,
  });
  if (!facts) {
    return experimentalAccessError('NOT_IN_ROOM', 'Room not found.');
  }
  const denied = evaluateExperimentalGameAccess(facts);
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
