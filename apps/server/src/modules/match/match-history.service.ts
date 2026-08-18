import { MatchStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { opsLogger } from '../../lib/ops-logger.js';
import type {
  BeginPersistedMatchInput,
  MatchParticipantResult,
} from './match-history.types.js';

type MatchWriteDb = {
  match: {
    findFirst: Prisma.TransactionClient['match']['findFirst'];
    create: Prisma.TransactionClient['match']['create'];
    update: Prisma.TransactionClient['match']['update'];
    updateMany: Prisma.TransactionClient['match']['updateMany'];
  };
  matchParticipant: {
    findMany: Prisma.TransactionClient['matchParticipant']['findMany'];
    update: Prisma.TransactionClient['matchParticipant']['update'];
  };
  room: {
    findUnique: Prisma.TransactionClient['room']['findUnique'];
  };
  player: {
    findMany: Prisma.TransactionClient['player']['findMany'];
  };
};

function logMatchHistoryFailure(stage: string, details: Record<string, unknown>): void {
  opsLogger.error('match-history-write-failed', 'تعذر حفظ سجل المباراة.', {
    stage,
    roomId: typeof details.roomId === 'string' ? details.roomId : undefined,
    gameId: typeof details.gameId === 'string' ? details.gameId : undefined,
    errorName: typeof details.errorName === 'string' ? details.errorName : undefined,
  });
}

async function findActiveMatchForRoom(roomId: string, db: MatchWriteDb = prisma) {
  return db.match.findFirst({
    where: {
      roomId,
      status: MatchStatus.ACTIVE,
    },
    orderBy: { startedAt: 'desc' },
  });
}

export async function beginPersistedMatch(
  input: BeginPersistedMatchInput,
  db: MatchWriteDb = prisma,
): Promise<string | null> {
  const { roomId, gameId, participantPlayerIds } = input;

  if (!gameId || participantPlayerIds.length === 0) {
    return null;
  }

  try {
    const existing = await findActiveMatchForRoom(roomId, db);
    if (existing) {
      return existing.id;
    }

    const room = await db.room.findUnique({
      where: { id: roomId },
      select: { code: true },
    });

    if (!room) {
      return null;
    }

    const players = await db.player.findMany({
      where: { id: { in: participantPlayerIds } },
      select: { id: true, name: true, userId: true },
    });
    const playerById = new Map(players.map((player) => [player.id, player]));

    const match = await db.match.create({
      data: {
        roomId,
        roomCode: room.code,
        gameId,
        status: MatchStatus.ACTIVE,
        participants: {
          create: participantPlayerIds.map((playerId) => {
            const player = playerById.get(playerId);
            return {
              playerId: player ? player.id : null,
              userId: player?.userId ?? null,
              displayName:
                player?.name ?? input.displayNameByPlayerId?.[playerId] ?? 'لاعب',
            };
          }),
        },
      },
      select: { id: true },
    });

    return match.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await findActiveMatchForRoom(roomId, db);
      return existing?.id ?? null;
    }

    logMatchHistoryFailure('begin-failed', {
      roomId,
      gameId,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return null;
  }
}

export async function completePersistedMatch(
  roomId: string,
  results: MatchParticipantResult[] = [],
  endedAt: Date = new Date(),
  db: MatchWriteDb = prisma,
): Promise<boolean> {
  try {
    const match = await findActiveMatchForRoom(roomId, db);
    if (!match) {
      return false;
    }

    const participants = await db.matchParticipant.findMany({
      where: { matchId: match.id },
      select: { id: true, playerId: true },
    });
    const resultByPlayerId = new Map(results.map((result) => [result.playerId, result]));

    for (const participant of participants) {
      if (!participant.playerId) {
        continue;
      }

      const result = resultByPlayerId.get(participant.playerId);
      if (!result) {
        continue;
      }

      await db.matchParticipant.update({
        where: { id: participant.id },
        data: {
          score: result.score ?? null,
          rank: result.rank ?? null,
          team: result.team ?? null,
          isWinner: result.isWinner ?? null,
        },
      });
    }

    await db.match.update({
      where: { id: match.id },
      data: {
        status: MatchStatus.COMPLETED,
        endedAt,
      },
    });

    return true;
  } catch (error) {
    logMatchHistoryFailure('complete-failed', {
      roomId,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return false;
  }
}

export async function abortActiveMatchesForRoom(
  roomId: string,
  endedAt: Date = new Date(),
  db: Pick<MatchWriteDb, 'match'> = prisma,
): Promise<number> {
  const updated = await db.match.updateMany({
    where: {
      roomId,
      status: MatchStatus.ACTIVE,
    },
    data: {
      status: MatchStatus.ABORTED,
      endedAt,
    },
  });

  return updated.count;
}

export async function abortPersistedMatch(
  roomId: string,
  endedAt: Date = new Date(),
  db: Pick<MatchWriteDb, 'match'> = prisma,
): Promise<boolean> {
  try {
    const aborted = await abortActiveMatchesForRoom(roomId, endedAt, db);
    return aborted > 0;
  } catch (error) {
    logMatchHistoryFailure('abort-failed', {
      roomId,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return false;
  }
}

export async function abortAllActiveMatches(endedAt: Date = new Date()): Promise<number> {
  const updated = await prisma.match.updateMany({
    where: { status: MatchStatus.ACTIVE },
    data: {
      status: MatchStatus.ABORTED,
      endedAt,
    },
  });

  return updated.count;
}
