import { MatchStatus, RoomStatus } from '@prisma/client';
import type { AdminSystemData, AdminSystemEnvironment } from '@wanasatna/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { getSocketServer } from '../../lib/socket-server.js';
import { countLiveGameShells } from '../game/game.service.js';

function publicEnvironment(): AdminSystemEnvironment {
  return env.nodeEnv === 'production' ? 'production' : 'development';
}

function connectedSocketCount(): number {
  const io = getSocketServer();
  if (!io) {
    return 0;
  }
  return io.engine.clientsCount;
}

export async function getAdminSystemSnapshot(): Promise<AdminSystemData> {
  const memory = process.memoryUsage();
  let databaseReachable = true;
  let rooms = 0;
  let activeMatches = 0;

  try {
    const [roomCount, matchCount] = await Promise.all([
      prisma.room.count({ where: { status: { not: RoomStatus.CLOSED } } }),
      prisma.match.count({ where: { status: MatchStatus.ACTIVE } }),
    ]);
    rooms = roomCount;
    activeMatches = matchCount;
  } catch {
    databaseReachable = false;
  }

  return {
    serverTime: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: publicEnvironment(),
    databaseReachable,
    connectedSockets: connectedSocketCount(),
    rooms,
    liveGameShells: countLiveGameShells(),
    activeMatches,
    memory: {
      rss: memory.rss,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
    },
  };
}
