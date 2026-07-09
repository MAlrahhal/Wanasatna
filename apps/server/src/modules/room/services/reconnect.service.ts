import { PlayerStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import type { HostChangedPayload, ReconnectResponse } from '@wanasatna/shared';
import { validateReconnectPayload } from '../room.validators.js';
import { isReconnectExpired, mapRoomSession } from '../room.utils.js';
import { transferHost } from './host.service.js';
import { cleanupRoomIfEmpty, deleteRoomWithRelations } from './room-cleanup.service.js';
import { assertRoomNotClosed, serviceError } from './shared-room.service.js';

export async function reconnectPlayer(payload: unknown): Promise<ReconnectResponse> {
  const validation = validateReconnectPayload(payload);

  if (!validation.success) {
    return validation;
  }

  const player = await prisma.player.findUnique({
    where: { id: validation.data.playerId },
    include: { room: true },
  });

  if (!player) {
    return serviceError('PLAYER_NOT_FOUND', 'Player not found.');
  }

  if (player.status === PlayerStatus.LEFT) {
    return serviceError('PLAYER_NOT_FOUND', 'Player session has ended.');
  }

  if (player.status === PlayerStatus.DISCONNECTED && isReconnectExpired(player.lastSeenAt)) {
    const wasHost = player.room.hostPlayerId === player.id;

    await prisma.player.update({
      where: { id: player.id },
      data: { status: PlayerStatus.LEFT },
    });

    let hostChanged: HostChangedPayload | null = null;

    if (wasHost) {
      hostChanged = await transferHost(player.roomId, player.id);

      if (!hostChanged) {
        await deleteRoomWithRelations(player.roomId);
        return serviceError('RECONNECT_EXPIRED', 'Reconnect window has expired.');
      }
    }

    await cleanupRoomIfEmpty(player.roomId);

    return {
      success: false,
      error: {
        code: 'RECONNECT_EXPIRED',
        message: 'Reconnect window has expired.',
      },
      hostChanged,
    };
  }

  const closedError = assertRoomNotClosed(player.room);

  if (closedError) {
    return closedError;
  }

  const updatedPlayer = await prisma.player.update({
    where: { id: player.id },
    data: {
      status: PlayerStatus.CONNECTED,
      lastSeenAt: new Date(),
    },
  });

  return {
    success: true,
    data: mapRoomSession(player.room, updatedPlayer),
  };
}
