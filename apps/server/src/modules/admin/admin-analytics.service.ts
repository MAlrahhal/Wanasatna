import { MatchStatus, Prisma, ProductEventType } from '@prisma/client';
import type {
  AdminAnalyticsDailyPoint,
  AdminAnalyticsData,
  AdminAnalyticsGameUsage,
  AdminAnalyticsRange,
} from '@wanasatna/shared';
import {
  ADMIN_ANALYTICS_DEFAULT_RANGE,
  ADMIN_DASHBOARD_GAME_IDS,
} from '@wanasatna/shared';
import { prisma } from '../../lib/prisma.js';

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

type DailyCountRow = {
  day: string;
  count: number | bigint;
};

type DailyMatchRow = {
  day: string;
  status: string;
  count: number | bigint;
};

function asCount(value: number | bigint | undefined): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function completionRate(completed: number, aborted: number): number | null {
  const denominator = completed + aborted;
  if (denominator === 0) {
    return null;
  }
  return completed / denominator;
}

function averageParticipants(totalParticipations: number, matchesStarted: number): number | null {
  if (matchesStarted === 0) {
    return null;
  }
  return totalParticipations / matchesStarted;
}

export function parseAdminAnalyticsRange(value: unknown): AdminAnalyticsRange {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === '24h' || raw === '7d' || raw === '30d' || raw === 'all') {
    return raw;
  }
  return ADMIN_ANALYTICS_DEFAULT_RANGE;
}

function windowForRange(range: AdminAnalyticsRange, now: Date): { from: Date | null; to: Date } {
  if (range === 'all') {
    return { from: null, to: now };
  }
  const durationMs = range === '24h' ? MS_DAY : range === '7d' ? 7 * MS_DAY : 30 * MS_DAY;
  return { from: new Date(now.getTime() - durationMs), to: now };
}

function utcDaysInclusive(from: Date, to: Date): string[] {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  const days: string[] = [];
  for (let time = start; time <= end; time += MS_DAY) {
    days.push(new Date(time).toISOString().slice(0, 10));
  }
  return days;
}

function countByType(
  groups: Array<{ type: ProductEventType; _count: { _all: number } }>,
  type: ProductEventType,
): number {
  return groups.find((group) => group.type === type)?._count._all ?? 0;
}

function countByStatus(
  groups: Array<{ status: MatchStatus; _count: { _all: number } }>,
  status: MatchStatus,
): number {
  return groups.find((group) => group.status === status)?._count._all ?? 0;
}

export async function getAdminAnalytics(rangeValue: unknown, now = new Date()): Promise<AdminAnalyticsData> {
  const range = parseAdminAnalyticsRange(rangeValue);
  const { from, to } = windowForRange(range, now);
  const eventWhere = from ? { createdAt: { gte: from } } : {};
  const matchWhere = from ? { startedAt: { gte: from } } : {};
  const includeDaily = range === '7d' || range === '30d';

  const [eventGroups, matchStatusGroups, matchGameGroups, totalParticipations, dailyRoomRows, dailyMatchRows] =
    await Promise.all([
      prisma.productEvent.groupBy({
        by: ['type'],
        where: eventWhere,
        _count: { _all: true },
      }),
      prisma.match.groupBy({
        by: ['status'],
        where: matchWhere,
        _count: { _all: true },
      }),
      prisma.match.groupBy({
        by: ['gameId', 'status'],
        where: matchWhere,
        _count: { _all: true },
      }),
      prisma.matchParticipant.count({
        where: { match: matchWhere },
      }),
      includeDaily && from
        ? prisma.$queryRaw<DailyCountRow[]>(Prisma.sql`
            SELECT (("createdAt" AT TIME ZONE 'UTC')::date)::text AS day, COUNT(*)::int AS count
            FROM "ProductEvent"
            WHERE "type" = CAST('ROOM_CREATED' AS "ProductEventType")
              AND "createdAt" >= ${from}
            GROUP BY 1
          `)
        : Promise.resolve([] as DailyCountRow[]),
      includeDaily && from
        ? prisma.$queryRaw<DailyMatchRow[]>(Prisma.sql`
            SELECT (("startedAt" AT TIME ZONE 'UTC')::date)::text AS day,
                   "status"::text AS status,
                   COUNT(*)::int AS count
            FROM "Match"
            WHERE "startedAt" >= ${from}
            GROUP BY 1, 2
          `)
        : Promise.resolve([] as DailyMatchRow[]),
    ]);

  const roomsCreated = countByType(eventGroups, ProductEventType.ROOM_CREATED);
  const roomsJoined = countByType(eventGroups, ProductEventType.ROOM_JOINED);
  const spectatorsJoined = countByType(eventGroups, ProductEventType.SPECTATOR_JOINED);
  const reconnectsSucceeded = countByType(eventGroups, ProductEventType.RECONNECT_SUCCEEDED);
  const roomsClosed = countByType(eventGroups, ProductEventType.ROOM_CLOSED);

  const matchesCompleted = countByStatus(matchStatusGroups, MatchStatus.COMPLETED);
  const matchesAborted = countByStatus(matchStatusGroups, MatchStatus.ABORTED);
  const matchesActive = countByStatus(matchStatusGroups, MatchStatus.ACTIVE);
  const matchesStarted = matchesCompleted + matchesAborted + matchesActive;

  const gamesById = new Map<string, AdminAnalyticsGameUsage>();
  for (const gameId of ADMIN_DASHBOARD_GAME_IDS) {
    gamesById.set(gameId, {
      gameId,
      started: 0,
      completed: 0,
      aborted: 0,
      completionRate: null,
    });
  }

  for (const group of matchGameGroups) {
    const current = gamesById.get(group.gameId);
    if (!current) {
      continue;
    }
    current.started += group._count._all;
    if (group.status === MatchStatus.COMPLETED) {
      current.completed += group._count._all;
    } else if (group.status === MatchStatus.ABORTED) {
      current.aborted += group._count._all;
    }
    current.completionRate = completionRate(current.completed, current.aborted);
    gamesById.set(group.gameId, current);
  }

  const canonicalIndex = new Map<string, number>(
    ADMIN_DASHBOARD_GAME_IDS.map((gameId, index) => [gameId, index]),
  );
  const games = [...gamesById.values()].sort((left, right) => {
    if (right.started !== left.started) {
      return right.started - left.started;
    }
    return (canonicalIndex.get(left.gameId) ?? 99) - (canonicalIndex.get(right.gameId) ?? 99);
  });

  let daily: AdminAnalyticsDailyPoint[] = [];
  if (includeDaily && from) {
    const roomsByDay = new Map<string, number>();
    for (const row of dailyRoomRows) {
      roomsByDay.set(row.day, asCount(row.count));
    }
    const matchesByDay = new Map<string, { started: number; completed: number; aborted: number }>();
    for (const row of dailyMatchRows) {
      const current = matchesByDay.get(row.day) ?? { started: 0, completed: 0, aborted: 0 };
      const count = asCount(row.count);
      current.started += count;
      if (row.status === MatchStatus.COMPLETED) {
        current.completed += count;
      } else if (row.status === MatchStatus.ABORTED) {
        current.aborted += count;
      }
      matchesByDay.set(row.day, current);
    }

    daily = utcDaysInclusive(from, to).map((date) => {
      const matchDay = matchesByDay.get(date);
      return {
        date,
        roomsCreated: roomsByDay.get(date) ?? 0,
        matchesStarted: matchDay?.started ?? 0,
        matchesCompleted: matchDay?.completed ?? 0,
        matchesAborted: matchDay?.aborted ?? 0,
      };
    });
  }

  return {
    range,
    from: from ? from.toISOString() : null,
    to: to.toISOString(),
    overview: {
      roomsCreated,
      roomsJoined,
      spectatorsJoined,
      reconnectsSucceeded,
      roomsClosed,
      matchesStarted,
      matchesCompleted,
      matchesAborted,
      matchesActive,
      completionRate: completionRate(matchesCompleted, matchesAborted),
    },
    participation: {
      totalParticipations,
      averageParticipants: averageParticipants(totalParticipations, matchesStarted),
    },
    games,
    daily,
  };
}

