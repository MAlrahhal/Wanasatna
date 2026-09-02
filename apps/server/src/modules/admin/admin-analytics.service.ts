import { MatchStatus, Prisma, ProductEventType, RoomCloseReason } from '@prisma/client';
import type {
  AdminAnalyticsActivityPoint,
  AdminAnalyticsDailyPoint,
  AdminAnalyticsData,
  AdminAnalyticsGameUsage,
  AdminAnalyticsMatchSizePoint,
  AdminAnalyticsRange,
  AdminAnalyticsRoomActivityPoint,
  AdminRoomHistoryCloseReasonPoint,
} from '@wanasatna/shared';
import {
  ADMIN_ANALYTICS_DEFAULT_RANGE,
  ADMIN_DASHBOARD_GAME_IDS,
} from '@wanasatna/shared';
import { prisma } from '../../lib/prisma.js';

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;
const RIYADH_OFFSET_MS = 3 * MS_HOUR;

function riyadhWallTime(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`((${column} + INTERVAL '3 hours') AT TIME ZONE 'UTC')`;
}

type HourCountRow = { hour: number | bigint | string; count: number | bigint | string };
type DailyCountRow = { day: string; count: number | bigint | string };
type DailyMatchRow = { day: string; status: string; count: number | bigint | string };
type ActivityRow = { bucket: string; status: string; count: number | bigint | string };
type ParticipationRow = { total: number | bigint | string; average: number | bigint | string | null };
type MatchSizeRow = { size: number | bigint | string; count: number | bigint | string };
type GameDetailRow = {
  gameId: string;
  lastPlayedAt: Date | null;
  averageParticipants: number | bigint | string | null;
  averageDurationSeconds: number | bigint | string | null;
  durationCount: number | bigint | string;
  durationTotalSeconds: number | bigint | string;
};
type RoomDetailRow = {
  averageParticipants: number | bigint | string | null;
  averageDurationSeconds: number | bigint | string | null;
  measuredRoomCount: number | bigint | string;
};

function asNumber(value: number | bigint | string | null | undefined): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asNullableNumber(value: number | bigint | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const result = asNumber(value);
  return Number.isFinite(result) ? result : null;
}

function completionRate(completed: number, aborted: number): number | null {
  const denominator = completed + aborted;
  return denominator === 0 ? null : completed / denominator;
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

function riyadhDateKey(value: Date): string {
  return new Date(value.getTime() + RIYADH_OFFSET_MS).toISOString().slice(0, 10);
}

function riyadhHourKey(value: Date): string {
  return new Date(value.getTime() + RIYADH_OFFSET_MS).toISOString().slice(0, 13);
}

function riyadhDaysInclusive(from: Date, to: Date): string[] {
  const start = Date.parse(`${riyadhDateKey(from)}T00:00:00.000Z`);
  const end = Date.parse(`${riyadhDateKey(to)}T00:00:00.000Z`);
  const days: string[] = [];
  for (let time = start; time <= end; time += MS_DAY) {
    days.push(new Date(time).toISOString().slice(0, 10));
  }
  return days;
}

function riyadhHoursInclusive(from: Date, to: Date): string[] {
  const start = Date.parse(`${riyadhHourKey(from)}:00:00.000Z`);
  const end = Date.parse(`${riyadhHourKey(to)}:00:00.000Z`);
  const hours: string[] = [];
  for (let time = start; time <= end; time += MS_HOUR) {
    hours.push(new Date(time).toISOString().slice(0, 13));
  }
  return hours;
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

function matchWindowSql(from: Date | null, to: Date): Prisma.Sql {
  return from
    ? Prisma.sql`m."startedAt" >= ${from} AND m."startedAt" <= ${to}`
    : Prisma.sql`m."startedAt" <= ${to}`;
}

function roomWindowSql(from: Date | null, to: Date): Prisma.Sql {
  return from
    ? Prisma.sql`rh."createdAt" >= ${from} AND rh."createdAt" <= ${to}`
    : Prisma.sql`rh."createdAt" <= ${to}`;
}

function matchWhere(from: Date | null, to: Date): Prisma.MatchWhereInput {
  return { startedAt: { ...(from ? { gte: from } : {}), lte: to } };
}

function roomWhere(from: Date | null, to: Date): Prisma.RoomHistoryWhereInput {
  return { createdAt: { ...(from ? { gte: from } : {}), lte: to } };
}

function participantCountsCte(window: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    WITH selected_matches AS (
      SELECT m.id, m."gameId", m."startedAt", m."endedAt"
      FROM "Match" m
      WHERE ${window}
    ), participant_counts AS (
      SELECT mp."matchId",
             COUNT(DISTINCT COALESCE(
               'p:' || mp."playerId",
               'u:' || mp."userId",
               'n:' || mp."displayName"
             ))::int AS participants
      FROM "MatchParticipant" mp
      INNER JOIN selected_matches sm ON sm.id = mp."matchId"
      GROUP BY mp."matchId"
    )
  `;
}

function statusActivity(
  rows: ActivityRow[],
  buckets: string[],
  hourly: boolean,
): AdminAnalyticsActivityPoint[] {
  const byBucket = new Map<string, { started: number; completed: number; aborted: number }>();
  for (const row of rows) {
    const current = byBucket.get(row.bucket) ?? { started: 0, completed: 0, aborted: 0 };
    const count = asNumber(row.count);
    current.started += count;
    if (row.status === MatchStatus.COMPLETED) {
      current.completed += count;
    } else if (row.status === MatchStatus.ABORTED) {
      current.aborted += count;
    }
    byBucket.set(row.bucket, current);
  }

  return buckets.map((bucket) => {
    const value = byBucket.get(bucket) ?? { started: 0, completed: 0, aborted: 0 };
    return {
      bucket,
      label: hourly ? `${bucket.slice(11, 13)}:00` : bucket.slice(5),
      matchesStarted: value.started,
      matchesCompleted: value.completed,
      matchesAborted: value.aborted,
    };
  });
}

export async function getAdminAnalytics(rangeValue: unknown, now = new Date()): Promise<AdminAnalyticsData> {
  const range = parseAdminAnalyticsRange(rangeValue);
  const { from, to } = windowForRange(range, now);
  const eventWhere = from ? { createdAt: { gte: from, lte: to } } : { createdAt: { lte: to } };
  const selectedMatchWhere = matchWhere(from, to);
  const selectedRoomWhere = roomWhere(from, to);
  const includeTimeSeries = range === '24h' || range === '7d' || range === '30d';
  const includeDaily = range === '7d' || range === '30d';
  const selectedMatchWindow = matchWindowSql(from, to);
  const selectedRoomWindow = roomWindowSql(from, to);
  const participantCte = participantCountsCte(selectedMatchWindow);

  const [
    eventGroups,
    matchStatusGroups,
    matchGameGroups,
    participationRows,
    matchSizeRows,
    gameDetailRows,
    activityRows,
    hourRows,
    dailyRoomRows,
    dailyMatchRows,
    coverage,
    roomCount,
    roomCloseGroups,
    roomDetailRows,
    roomActivityRows,
  ] = await Promise.all([
    prisma.productEvent.groupBy({ by: ['type'], where: eventWhere, _count: { _all: true } }),
    prisma.match.groupBy({ by: ['status'], where: selectedMatchWhere, _count: { _all: true } }),
    prisma.match.groupBy({
      by: ['gameId', 'status'],
      where: selectedMatchWhere,
      _count: { _all: true },
    }),
    prisma.$queryRaw<ParticipationRow[]>(Prisma.sql`
      ${participantCte}
      SELECT COALESCE(SUM(COALESCE(pc.participants, 0)), 0)::int AS total,
             AVG(COALESCE(pc.participants, 0))::float8 AS average
      FROM selected_matches sm
      LEFT JOIN participant_counts pc ON pc."matchId" = sm.id
    `),
    prisma.$queryRaw<MatchSizeRow[]>(Prisma.sql`
      ${participantCte}
      SELECT COALESCE(pc.participants, 0) AS size, COUNT(*)::int AS count
      FROM selected_matches sm
      LEFT JOIN participant_counts pc ON pc."matchId" = sm.id
      GROUP BY 1
      ORDER BY 1
    `),
    prisma.$queryRaw<GameDetailRow[]>(Prisma.sql`
      ${participantCte}
      SELECT sm."gameId" AS "gameId",
             MAX(sm."startedAt") AS "lastPlayedAt",
             AVG(COALESCE(pc.participants, 0))::float8 AS "averageParticipants",
             AVG(CASE
               WHEN sm."endedAt" IS NOT NULL AND sm."endedAt" >= sm."startedAt"
               THEN EXTRACT(EPOCH FROM (sm."endedAt" - sm."startedAt"))
             END)::float8 AS "averageDurationSeconds",
             COUNT(CASE
               WHEN sm."endedAt" IS NOT NULL AND sm."endedAt" >= sm."startedAt" THEN 1
             END)::int AS "durationCount",
             COALESCE(SUM(CASE
               WHEN sm."endedAt" IS NOT NULL AND sm."endedAt" >= sm."startedAt"
               THEN EXTRACT(EPOCH FROM (sm."endedAt" - sm."startedAt"))
             END), 0)::float8 AS "durationTotalSeconds"
      FROM selected_matches sm
      LEFT JOIN participant_counts pc ON pc."matchId" = sm.id
      GROUP BY sm."gameId"
    `),
    includeTimeSeries && from
      ? prisma.$queryRaw<ActivityRow[]>(Prisma.sql`
          SELECT ${range === '24h'
            ? Prisma.sql`TO_CHAR(${riyadhWallTime(Prisma.sql`m."startedAt"`)}, 'YYYY-MM-DD"T"HH24')`
            : Prisma.sql`TO_CHAR(${riyadhWallTime(Prisma.sql`m."startedAt"`)}, 'YYYY-MM-DD')`} AS bucket,
                 m.status::text AS status,
                 COUNT(*)::int AS count
          FROM "Match" m
          WHERE ${selectedMatchWindow}
          GROUP BY 1, 2
        `)
      : Promise.resolve([] as ActivityRow[]),
    prisma.$queryRaw<HourCountRow[]>(Prisma.sql`
      SELECT EXTRACT(HOUR FROM ${riyadhWallTime(Prisma.sql`m."startedAt"`)})::int AS hour,
             COUNT(*)::int AS count
      FROM "Match" m
      WHERE ${selectedMatchWindow}
      GROUP BY 1
    `),
    includeDaily && from
      ? prisma.$queryRaw<DailyCountRow[]>(Prisma.sql`
          SELECT TO_CHAR(${riyadhWallTime(Prisma.sql`"createdAt"`)}, 'YYYY-MM-DD') AS day,
                 COUNT(*)::int AS count
          FROM "ProductEvent"
          WHERE "type" = CAST('ROOM_CREATED' AS "ProductEventType")
            AND "createdAt" >= ${from} AND "createdAt" <= ${to}
          GROUP BY 1
        `)
      : Promise.resolve([] as DailyCountRow[]),
    includeDaily && from
      ? prisma.$queryRaw<DailyMatchRow[]>(Prisma.sql`
          SELECT TO_CHAR(${riyadhWallTime(Prisma.sql`"startedAt"`)}, 'YYYY-MM-DD') AS day,
                 status::text AS status,
                 COUNT(*)::int AS count
          FROM "Match"
          WHERE "startedAt" >= ${from} AND "startedAt" <= ${to}
          GROUP BY 1, 2
        `)
      : Promise.resolve([] as DailyMatchRow[]),
    prisma.roomHistory.aggregate({ _min: { historyStartedAt: true } }),
    prisma.roomHistory.count({ where: selectedRoomWhere }),
    prisma.roomHistory.groupBy({
      by: ['closeReason'],
      where: { ...selectedRoomWhere, closeReason: { not: null } },
      _count: { _all: true },
    }),
    prisma.$queryRaw<RoomDetailRow[]>(Prisma.sql`
      WITH selected_rooms AS (
        SELECT rh.id, rh."createdAt", rh."closedAt"
        FROM "RoomHistory" rh
        WHERE ${selectedRoomWindow}
      ), participant_counts AS (
        SELECT rph."roomHistoryId", COUNT(DISTINCT rph."livePlayerId")::int AS participants
        FROM "RoomParticipationHistory" rph
        INNER JOIN selected_rooms sr ON sr.id = rph."roomHistoryId"
        WHERE rph."joinedAsSpectator" IS DISTINCT FROM true
        GROUP BY rph."roomHistoryId"
      )
      SELECT AVG(COALESCE(pc.participants, 0))::float8 AS "averageParticipants",
             AVG(CASE
               WHEN sr."closedAt" IS NOT NULL AND sr."closedAt" >= sr."createdAt"
               THEN EXTRACT(EPOCH FROM (sr."closedAt" - sr."createdAt"))
             END)::float8 AS "averageDurationSeconds",
             COUNT(CASE
               WHEN sr."closedAt" IS NOT NULL AND sr."closedAt" >= sr."createdAt" THEN 1
             END)::int AS "measuredRoomCount"
      FROM selected_rooms sr
      LEFT JOIN participant_counts pc ON pc."roomHistoryId" = sr.id
    `),
    includeTimeSeries && from
      ? prisma.$queryRaw<DailyCountRow[]>(Prisma.sql`
          SELECT TO_CHAR(${riyadhWallTime(Prisma.sql`rh."createdAt"`)}, 'YYYY-MM-DD') AS day,
                 COUNT(*)::int AS count
          FROM "RoomHistory" rh
          WHERE ${selectedRoomWindow}
          GROUP BY 1
        `)
      : Promise.resolve([] as DailyCountRow[]),
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
      matchShare: 0,
      lastPlayedAt: null,
      averageParticipants: null,
      averageDurationSeconds: null,
    });
  }

  for (const group of matchGameGroups) {
    const current = gamesById.get(group.gameId);
    if (!current) {
      continue;
    }
    current.started += group._count._all;
    if (group.status === MatchStatus.COMPLETED) current.completed += group._count._all;
    if (group.status === MatchStatus.ABORTED) current.aborted += group._count._all;
  }

  let measuredDurationCount = 0;
  let totalDurationSeconds = 0;
  for (const row of gameDetailRows) {
    const current = gamesById.get(row.gameId);
    if (!current) continue;
    current.lastPlayedAt = row.lastPlayedAt ? row.lastPlayedAt.toISOString() : null;
    current.averageParticipants = asNullableNumber(row.averageParticipants);
    current.averageDurationSeconds = asNullableNumber(row.averageDurationSeconds);
    measuredDurationCount += asNumber(row.durationCount);
    totalDurationSeconds += asNumber(row.durationTotalSeconds);
  }

  for (const game of gamesById.values()) {
    game.completionRate = completionRate(game.completed, game.aborted);
    game.matchShare = matchesStarted === 0 ? 0 : game.started / matchesStarted;
  }

  const canonicalIndex = new Map<string, number>(
    ADMIN_DASHBOARD_GAME_IDS.map((gameId, index) => [gameId, index]),
  );
  const games = [...gamesById.values()].sort((left, right) =>
    right.started !== left.started
      ? right.started - left.started
      : (canonicalIndex.get(left.gameId) ?? 99) - (canonicalIndex.get(right.gameId) ?? 99),
  );

  const participation = participationRows[0] ?? { total: 0, average: null };
  const matchSizeDistribution: AdminAnalyticsMatchSizePoint[] = matchSizeRows.map((row) => ({
    size: asNumber(row.size),
    matchCount: asNumber(row.count),
  }));

  const hourly = Array.from({ length: 24 }, () => 0);
  for (const row of hourRows) {
    const hour = asNumber(row.hour);
    if (hour >= 0 && hour < 24) hourly[hour] = asNumber(row.count);
  }

  let daily: AdminAnalyticsDailyPoint[] = [];
  let activity: AdminAnalyticsActivityPoint[] = [];
  if (includeTimeSeries && from) {
    const buckets = range === '24h' ? riyadhHoursInclusive(from, to) : riyadhDaysInclusive(from, to);
    activity = statusActivity(activityRows, buckets, range === '24h');
  }
  if (includeDaily && from) {
    const roomsByDay = new Map(dailyRoomRows.map((row) => [row.day, asNumber(row.count)]));
    const matchesByDay = new Map<string, { started: number; completed: number; aborted: number }>();
    for (const row of dailyMatchRows) {
      const current = matchesByDay.get(row.day) ?? { started: 0, completed: 0, aborted: 0 };
      current.started += asNumber(row.count);
      if (row.status === MatchStatus.COMPLETED) current.completed += asNumber(row.count);
      if (row.status === MatchStatus.ABORTED) current.aborted += asNumber(row.count);
      matchesByDay.set(row.day, current);
    }
    daily = riyadhDaysInclusive(from, to).map((date) => {
      const matches = matchesByDay.get(date);
      return {
        date,
        roomsCreated: roomsByDay.get(date) ?? 0,
        matchesStarted: matches?.started ?? 0,
        matchesCompleted: matches?.completed ?? 0,
        matchesAborted: matches?.aborted ?? 0,
      };
    });
  }

  const coverageStartedAt = coverage._min.historyStartedAt;
  const roomCoverageAvailable = coverageStartedAt !== null;
  const isPartialForRange = Boolean(
    coverageStartedAt && (from === null || from.getTime() < coverageStartedAt.getTime()),
  );
  const roomDetail = roomDetailRows[0];
  const closeReasons: AdminRoomHistoryCloseReasonPoint[] = Object.values(RoomCloseReason).map((reason) => ({
    reason,
    roomCount: roomCloseGroups.find((group) => group.closeReason === reason)?._count._all ?? 0,
  }));
  const roomActivityByDay = new Map(roomActivityRows.map((row) => [row.day, asNumber(row.count)]));
  const roomActivity: AdminAnalyticsRoomActivityPoint[] =
    includeTimeSeries && from
      ? riyadhDaysInclusive(from, to).map((date) => ({
          date,
          roomsCreated: roomActivityByDay.get(date) ?? 0,
        }))
      : [];

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
      totalParticipations: asNumber(participation.total),
      averageParticipants: asNullableNumber(participation.average),
    },
    games,
    daily,
    activity,
    matchSizeDistribution,
    duration: {
      averageSeconds: measuredDurationCount === 0 ? null : totalDurationSeconds / measuredDurationCount,
      measuredMatchCount: measuredDurationCount,
    },
    startsBySaudiHour: hourly,
    roomHistory: {
      coverageStartedAt: coverageStartedAt?.toISOString() ?? null,
      isPartialForRange,
      roomsCreated: roomCoverageAvailable ? roomCount : null,
      averageDurationSeconds: roomCoverageAvailable
        ? asNullableNumber(roomDetail?.averageDurationSeconds)
        : null,
      measuredRoomCount: roomCoverageAvailable ? asNumber(roomDetail?.measuredRoomCount) : 0,
      averageParticipants: roomCoverageAvailable
        ? asNullableNumber(roomDetail?.averageParticipants)
        : null,
      closeReasons,
      activity: roomActivity,
    },
  };
}
