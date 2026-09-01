import { MatchStatus, Prisma } from '@prisma/client';
import type {
  AdminActionResponse,
  AdminMatchStatus,
  AdminRoomHistoryData,
  AdminRoomHistoryDetails,
  AdminRoomHistoryListItem,
} from '@wanasatna/shared';
import { ADMIN_ROOM_HISTORY_PAGE_SIZE, ADMIN_SEARCH_QUERY_MAX_LENGTH } from '@wanasatna/shared';
import { prisma } from '../../lib/prisma.js';

export const ADMIN_ROOM_HISTORY_NOT_FOUND_MESSAGE = 'سجل الغرفة غير موجود.';

export type AdminRoomHistoryQuery = {
  roomCode?: unknown;
  participant?: unknown;
  host?: unknown;
  gameId?: unknown;
  createdFrom?: unknown;
  createdTo?: unknown;
  state?: unknown;
  page?: unknown;
};

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
  return Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
}

function normalizeSearch(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const value = raw.trim();
  return value ? value.slice(0, ADMIN_SEARCH_QUERY_MAX_LENGTH) : null;
}

function normalizeGameId(raw: unknown): string | null {
  const value = normalizeSearch(raw);
  return value && /^[a-z0-9-]+$/i.test(value) ? value : null;
}

function parseDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }
  const value = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== raw ? null : value;
}

export function buildAdminRoomHistoryWhere(
  query: AdminRoomHistoryQuery,
): Prisma.RoomHistoryWhereInput {
  const roomCode = normalizeSearch(query.roomCode);
  const participant = normalizeSearch(query.participant);
  const host = normalizeSearch(query.host);
  const gameId = normalizeGameId(query.gameId);
  const createdFrom = parseDate(query.createdFrom);
  const createdTo = parseDate(query.createdTo);
  const filters: Prisma.RoomHistoryWhereInput[] = [];

  if (roomCode) {
    filters.push({ roomCode: { contains: roomCode, mode: 'insensitive' } });
  }
  if (participant) {
    filters.push({
      participations: {
        some: { displayName: { contains: participant, mode: 'insensitive' } },
      },
    });
  }
  if (host) {
    filters.push({
      OR: [
        { originalHostName: { contains: host, mode: 'insensitive' } },
        { currentHostName: { contains: host, mode: 'insensitive' } },
      ],
    });
  }
  if (gameId) {
    filters.push({ matches: { some: { gameId } } });
  }
  if (createdFrom) {
    filters.push({ createdAt: { gte: createdFrom } });
  }
  if (createdTo) {
    const exclusiveEnd = new Date(createdTo);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    filters.push({ createdAt: { lt: exclusiveEnd } });
  }
  if (query.state === 'OPEN') {
    filters.push({ closedAt: null });
  } else if (query.state === 'CLOSED') {
    filters.push({ closedAt: { not: null } });
  }

  return filters.length ? { AND: filters } : {};
}

type RoomHistoryListRow = {
  id: string;
  roomCode: string;
  originalHostName: string | null;
  currentHostName: string;
  createdAt: Date;
  historyStartedAt: Date;
  closedAt: Date | null;
  closeReason: AdminRoomHistoryListItem['closeReason'];
  playerCap: number;
  isLocked: boolean;
  isComplete: boolean;
  _count: { participations: number; matches: number };
};

function mapRoomHistoryListItem(row: RoomHistoryListRow): AdminRoomHistoryListItem {
  return {
    id: row.id,
    roomCode: row.roomCode,
    originalHostName: row.originalHostName,
    currentHostName: row.currentHostName,
    createdAt: toIso(row.createdAt),
    historyStartedAt: toIso(row.historyStartedAt),
    closedAt: row.closedAt ? toIso(row.closedAt) : null,
    closeReason: row.closeReason,
    participantCount: row._count.participations,
    matchCount: row._count.matches,
    playerCap: row.playerCap,
    isLocked: row.isLocked,
    isComplete: row.isComplete,
    state: row.closedAt ? 'CLOSED' : 'OPEN',
  };
}

const ROOM_HISTORY_LIST_SELECT = {
  id: true,
  roomCode: true,
  originalHostName: true,
  currentHostName: true,
  createdAt: true,
  historyStartedAt: true,
  closedAt: true,
  closeReason: true,
  playerCap: true,
  isLocked: true,
  isComplete: true,
  _count: { select: { participations: true, matches: true } },
} satisfies Prisma.RoomHistorySelect;

export async function listAdminRoomHistory(
  query: AdminRoomHistoryQuery = {},
): Promise<AdminRoomHistoryData> {
  const page = parsePage(query.page);
  const pageSize = ADMIN_ROOM_HISTORY_PAGE_SIZE;
  const where = buildAdminRoomHistoryWhere(query);
  const [total, rows] = await Promise.all([
    prisma.roomHistory.count({ where }),
    prisma.roomHistory.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: ROOM_HISTORY_LIST_SELECT,
    }),
  ]);

  return {
    rooms: rows.map(mapRoomHistoryListItem),
    total,
    page,
    pageSize,
  };
}

export async function getAdminRoomHistoryById(
  historyId: string,
): Promise<AdminActionResponse<AdminRoomHistoryDetails>> {
  const row = await prisma.roomHistory.findUnique({
    where: { id: historyId },
    select: {
      ...ROOM_HISTORY_LIST_SELECT,
      liveRoomId: true,
      wasEverLocked: true,
      createdByAdmin: true,
      liveRoom: { select: { id: true } },
      participations: {
        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          displayName: true,
          joinedAt: true,
          leftAt: true,
          joinedAsSpectator: true,
          wasHost: true,
        },
      },
      hostChanges: {
        orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
        select: { id: true, displayName: true, assignedAt: true },
      },
      matches: {
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          gameId: true,
          roomCode: true,
          status: true,
          startedAt: true,
          endedAt: true,
          _count: { select: { participants: true } },
          participants: {
            where: { OR: [{ isWinner: true }, { rank: 1 }] },
            orderBy: { createdAt: 'asc' },
            select: { displayName: true },
          },
        },
      },
    },
  });

  if (!row) {
    return {
      success: false,
      error: {
        code: 'ROOM_HISTORY_NOT_FOUND',
        message: ADMIN_ROOM_HISTORY_NOT_FOUND_MESSAGE,
      },
    };
  }

  return {
    success: true,
    data: {
      ...mapRoomHistoryListItem(row),
      liveRoomId: row.liveRoomId,
      isCurrentlyLive: Boolean(row.liveRoom),
      wasEverLocked: row.wasEverLocked,
      createdByAdmin: row.createdByAdmin,
      participants: row.participations.map((participant) => ({
        id: participant.id,
        displayName: participant.displayName,
        joinedAt: toIso(participant.joinedAt),
        leftAt: participant.leftAt ? toIso(participant.leftAt) : null,
        joinedAsSpectator: participant.joinedAsSpectator,
        wasHost: participant.wasHost,
      })),
      hostAssignments: row.hostChanges.map((assignment) => ({
        id: assignment.id,
        displayName: assignment.displayName,
        assignedAt: toIso(assignment.assignedAt),
      })),
      matches: row.matches.map((match) => ({
        id: match.id,
        gameId: match.gameId,
        roomCode: match.roomCode,
        status: asMatchStatus(match.status),
        startedAt: toIso(match.startedAt),
        endedAt: match.endedAt ? toIso(match.endedAt) : null,
        participantCount: match._count.participants,
        winnerDisplayNames: [...new Set(match.participants.map((row) => row.displayName))],
      })),
    },
  };
}
