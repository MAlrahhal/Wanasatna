import { MatchStatus, type Prisma } from '@prisma/client';
import type {
  AdminActionResponse,
  AdminHistoryData,
  AdminMatchDetails,
  AdminMatchStatus,
} from '@wanasatna/shared';
import { ADMIN_HISTORY_PAGE_SIZE } from '@wanasatna/shared';
import { prisma } from '../../lib/prisma.js';

function toIso(value: Date): string {
  return value.toISOString();
}

function asMatchStatus(status: MatchStatus): AdminMatchStatus {
  if (status === MatchStatus.COMPLETED) {
    return 'COMPLETED';
  }
  if (status === MatchStatus.ABORTED) {
    return 'ABORTED';
  }
  return 'ACTIVE';
}

function parsePage(raw: unknown): number {
  const page = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : 1;
  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }
  return Math.min(page, 10_000);
}

function parseStatus(raw: unknown): MatchStatus | undefined {
  if (raw === 'ACTIVE' || raw === 'COMPLETED' || raw === 'ABORTED') {
    return raw;
  }
  return undefined;
}

function parseGameId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const gameId = raw.trim();
  if (!gameId || gameId.length > 64 || !/^[a-z0-9-]+$/i.test(gameId)) {
    return undefined;
  }
  return gameId;
}

export async function listAdminHistory(
  query: { gameId?: unknown; status?: unknown; page?: unknown },
): Promise<AdminHistoryData> {
  const page = parsePage(query.page);
  const pageSize = ADMIN_HISTORY_PAGE_SIZE;
  const gameId = parseGameId(query.gameId);
  const status = parseStatus(query.status);
  const where: Prisma.MatchWhereInput = {
    ...(gameId ? { gameId } : {}),
    ...(status ? { status } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.match.count({ where }),
    prisma.match.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        gameId: true,
        roomCode: true,
        status: true,
        startedAt: true,
        endedAt: true,
        _count: { select: { participants: true } },
      },
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    matches: rows.map((match) => ({
      id: match.id,
      gameId: match.gameId,
      roomCode: match.roomCode,
      status: asMatchStatus(match.status),
      startedAt: toIso(match.startedAt),
      endedAt: match.endedAt ? toIso(match.endedAt) : null,
      participantCount: match._count.participants,
    })),
  };
}

export async function getAdminMatchById(
  matchId: string,
): Promise<AdminActionResponse<AdminMatchDetails>> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      gameId: true,
      roomCode: true,
      status: true,
      startedAt: true,
      endedAt: true,
      _count: { select: { participants: true } },
      participants: {
        orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
        select: {
          displayName: true,
          userId: true,
          score: true,
          rank: true,
          team: true,
          isWinner: true,
        },
      },
    },
  });

  if (!match) {
    return {
      success: false,
      error: { code: 'MATCH_NOT_FOUND', message: 'المباراة غير موجودة.' },
    };
  }

  return {
    success: true,
    data: {
      id: match.id,
      gameId: match.gameId,
      roomCode: match.roomCode,
      status: asMatchStatus(match.status),
      startedAt: toIso(match.startedAt),
      endedAt: match.endedAt ? toIso(match.endedAt) : null,
      participantCount: match._count.participants,
      participants: match.participants.map((participant) => ({
        displayName: participant.displayName,
        hasLinkedUser: Boolean(participant.userId),
        userId: participant.userId,
        score: participant.score,
        rank: participant.rank,
        team: participant.team,
        isWinner: participant.isWinner,
      })),
    },
  };
}
