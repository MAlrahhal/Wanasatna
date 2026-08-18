import { Prisma } from '@prisma/client';
import type {
  AdminActionResponse,
  AdminUserDetails,
  AdminUserMatchRow,
  AdminUsersData,
} from '@wanasatna/shared';
import {
  ADMIN_SEARCH_QUERY_MAX_LENGTH,
  ADMIN_USER_MATCH_HISTORY_LIMIT,
  ADMIN_USERS_PAGE_SIZE,
} from '@wanasatna/shared';
import { prisma } from '../../lib/prisma.js';

function toIso(value: Date): string {
  return value.toISOString();
}

function asMatchStatus(status: 'ACTIVE' | 'COMPLETED' | 'ABORTED'): AdminUserMatchRow['status'] {
  return status;
}

function normalizeSearch(raw: string | undefined): string | null {
  const value = raw?.trim() ?? '';
  if (!value) {
    return null;
  }
  return value.slice(0, ADMIN_SEARCH_QUERY_MAX_LENGTH);
}

function parsePage(raw: unknown): number {
  const page = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : 1;
  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }
  return Math.min(page, 10_000);
}

function userSearchWhere(search: string | null): Prisma.UserWhereInput | undefined {
  if (!search) {
    return undefined;
  }
  return {
    OR: [
      { email: { contains: search, mode: 'insensitive' } },
      { preferredDisplayName: { contains: search, mode: 'insensitive' } },
    ],
  };
}

export async function listAdminUsers(
  query: { q?: string; page?: unknown },
): Promise<AdminUsersData> {
  const search = normalizeSearch(query.q);
  const page = parsePage(query.page);
  const pageSize = ADMIN_USERS_PAGE_SIZE;
  const where = userSearchWhere(search);

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        preferredDisplayName: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { matchParticipations: true } },
        matchParticipations: {
          orderBy: { match: { startedAt: 'desc' } },
          take: 1,
          select: { match: { select: { startedAt: true } } },
        },
      },
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    users: rows.map((user) => ({
      id: user.id,
      preferredDisplayName: user.preferredDisplayName,
      email: user.email,
      role: user.role,
      createdAt: toIso(user.createdAt),
      matchCount: user._count.matchParticipations,
      lastMatchAt: user.matchParticipations[0]?.match.startedAt
        ? toIso(user.matchParticipations[0].match.startedAt)
        : null,
    })),
  };
}

export async function getAdminUserById(
  userId: string,
): Promise<AdminActionResponse<AdminUserDetails>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      preferredDisplayName: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { matchParticipations: true } },
      matchParticipations: {
        orderBy: { match: { startedAt: 'desc' } },
        take: ADMIN_USER_MATCH_HISTORY_LIMIT,
        select: {
          displayName: true,
          score: true,
          rank: true,
          team: true,
          isWinner: true,
          match: {
            select: {
              id: true,
              gameId: true,
              roomCode: true,
              status: true,
              startedAt: true,
              endedAt: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return {
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'المستخدم غير موجود.' },
    };
  }

  return {
    success: true,
    data: {
      id: user.id,
      preferredDisplayName: user.preferredDisplayName,
      email: user.email,
      role: user.role,
      createdAt: toIso(user.createdAt),
      matchCount: user._count.matchParticipations,
      lastMatchAt: user.matchParticipations[0]?.match.startedAt
        ? toIso(user.matchParticipations[0].match.startedAt)
        : null,
      matches: user.matchParticipations.map((participation) => ({
        matchId: participation.match.id,
        gameId: participation.match.gameId,
        roomCode: participation.match.roomCode,
        status: asMatchStatus(participation.match.status),
        startedAt: toIso(participation.match.startedAt),
        endedAt: participation.match.endedAt ? toIso(participation.match.endedAt) : null,
        displayName: participation.displayName,
        score: participation.score,
        rank: participation.rank,
        team: participation.team,
        isWinner: participation.isWinner,
      })),
    },
  };
}
