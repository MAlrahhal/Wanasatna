import { MatchStatus, PlayerStatus, RoomStatus } from '@prisma/client';
import type {
  AdminDashboardData,
  AdminGameUsage,
  AdminLiveRoom,
  AdminMatchStatus,
  AdminRecentMatch,
  AdminRecentUser,
} from '@wanasatna/shared';
import {
  ADMIN_DASHBOARD_GAME_IDS,
  ADMIN_DASHBOARD_RECENT_MATCHES_LIMIT,
  ADMIN_DASHBOARD_RECENT_USERS_LIMIT,
} from '@wanasatna/shared';
import { prisma } from '../../lib/prisma.js';
import { getGameShellByRoomId } from '../game/game.service.js';

const SEAT_STATUSES = [PlayerStatus.CONNECTED, PlayerStatus.DISCONNECTED] as const;

function toIso(value: Date): string {
  return value.toISOString();
}

function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const todayUtc = startOfUtcDay();

  const [
    registeredUsers,
    currentRooms,
    playerGroups,
    completedMatches,
    abortedMatches,
    matchesStartedTodayUtc,
    liveRoomRows,
    recentUserRows,
    recentMatchRows,
    usageGroups,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.room.count({ where: { status: { not: RoomStatus.CLOSED } } }),
    prisma.player.groupBy({
      by: ['status', 'isSpectator'],
      where: {
        status: { in: [...SEAT_STATUSES] },
        room: { status: { not: RoomStatus.CLOSED } },
      },
      _count: { _all: true },
    }),
    prisma.match.count({ where: { status: MatchStatus.COMPLETED } }),
    prisma.match.count({ where: { status: MatchStatus.ABORTED } }),
    prisma.match.count({ where: { startedAt: { gte: todayUtc } } }),
    prisma.room.findMany({
      where: { status: { not: RoomStatus.CLOSED } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        code: true,
        createdAt: true,
        isLocked: true,
        playerCap: true,
        hostPlayer: { select: { name: true } },
        players: {
          where: { status: { in: [...SEAT_STATUSES] } },
          select: { status: true, isSpectator: true },
        },
      },
    }),
    prisma.user.findMany({
      take: ADMIN_DASHBOARD_RECENT_USERS_LIMIT,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        preferredDisplayName: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.match.findMany({
      take: ADMIN_DASHBOARD_RECENT_MATCHES_LIMIT,
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        gameId: true,
        roomCode: true,
        status: true,
        startedAt: true,
        endedAt: true,
        _count: { select: { participants: true } },
        participants: {
          where: { isWinner: true },
          select: { displayName: true },
        },
      },
    }),
    prisma.match.groupBy({
      by: ['gameId', 'status'],
      where: { status: { in: [MatchStatus.COMPLETED, MatchStatus.ABORTED] } },
      _count: { _all: true },
    }),
  ]);

  let connectedPlayers = 0;
  let disconnectedPlayers = 0;
  let spectators = 0;

  for (const group of playerGroups) {
    const count = group._count._all;
    if (group.status === PlayerStatus.CONNECTED) {
      connectedPlayers += count;
    } else if (group.status === PlayerStatus.DISCONNECTED) {
      disconnectedPlayers += count;
    }
    if (group.isSpectator) {
      spectators += count;
    }
  }

  const liveRooms: AdminLiveRoom[] = liveRoomRows.map((room) => {
    const connectedCount = room.players.filter((player) => player.status === PlayerStatus.CONNECTED)
      .length;
    const disconnectedCount = room.players.filter(
      (player) => player.status === PlayerStatus.DISCONNECTED,
    ).length;
    const spectatorCount = room.players.filter((player) => player.isSpectator).length;
    const shell = getGameShellByRoomId(room.id);

    return {
      id: room.id,
      code: room.code,
      createdAt: toIso(room.createdAt),
      isLocked: room.isLocked,
      playerCount: room.players.length,
      connectedCount,
      disconnectedCount,
      spectatorCount,
      hostDisplayName: room.hostPlayer.name,
      playerCap: room.playerCap,
      activity: shell ? 'IN_GAME' : 'LOBBY',
      gameId: shell?.gameId ?? null,
      gamePhase: shell?.phase ?? null,
    };
  });

  const recentUsers: AdminRecentUser[] = recentUserRows.map((user) => ({
    id: user.id,
    email: user.email,
    preferredDisplayName: user.preferredDisplayName,
    role: user.role,
    createdAt: toIso(user.createdAt),
  }));

  const recentMatches: AdminRecentMatch[] = recentMatchRows.map((match) => ({
    id: match.id,
    gameId: match.gameId,
    roomCode: match.roomCode,
    status: asMatchStatus(match.status),
    startedAt: toIso(match.startedAt),
    endedAt: match.endedAt ? toIso(match.endedAt) : null,
    participantCount: match._count.participants,
    winnerDisplayNames: match.participants
      .map((participant) => participant.displayName)
      .filter((name) => name.length > 0),
  }));

  const usageByGame = new Map<string, AdminGameUsage>();
  for (const gameId of ADMIN_DASHBOARD_GAME_IDS) {
    usageByGame.set(gameId, {
      gameId,
      completedCount: 0,
      abortedCount: 0,
      totalCount: 0,
    });
  }

  for (const group of usageGroups) {
    const current = usageByGame.get(group.gameId) ?? {
      gameId: group.gameId,
      completedCount: 0,
      abortedCount: 0,
      totalCount: 0,
    };
    if (group.status === MatchStatus.COMPLETED) {
      current.completedCount += group._count._all;
    } else if (group.status === MatchStatus.ABORTED) {
      current.abortedCount += group._count._all;
    }
    current.totalCount = current.completedCount + current.abortedCount;
    usageByGame.set(group.gameId, current);
  }

  const gameUsage = [...usageByGame.values()];

  return {
    summary: {
      registeredUsers,
      currentRooms,
      currentSeats: connectedPlayers + disconnectedPlayers,
      connectedPlayers,
      disconnectedPlayers,
      spectators,
      completedMatches,
      abortedMatches,
      matchesStartedTodayUtc,
      roomsWithLiveGame: liveRooms.filter((room) => room.activity === 'IN_GAME').length,
    },
    liveRooms,
    recentUsers,
    recentMatches,
    gameUsage,
  };
}
