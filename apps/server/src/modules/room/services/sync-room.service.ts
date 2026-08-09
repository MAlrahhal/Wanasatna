import { PlayerStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import type { RoomActionResponse, RoomSessionData } from '@wanasatna/shared';
import { loadActiveRoomPlayers, mapRoomSession } from '../room.utils.js';
import { assertRoomNotClosed, serviceError } from './shared-room.service.js';

/**
 * Authoritative room resync for a socket that already has playerId/roomId bound.
 * Does not rotate reconnect tokens.
 */
export async function syncBoundRoomSession(
  playerId: string,
  roomId: string,
): Promise<RoomActionResponse<RoomSessionData>> {
  const player = await prisma.player.findFirst({
    where: { id: playerId, roomId },
    include: { room: true },
  });

  if (!player) {
    return serviceError('PLAYER_NOT_FOUND', 'Player not found in this room.');
  }

  if (player.status === PlayerStatus.LEFT) {
    return serviceError('PLAYER_NOT_FOUND', 'Player session has ended.');
  }

  const closedError = assertRoomNotClosed(player.room);

  if (closedError) {
    return closedError;
  }

  // Refresh presence for the active socket without inventing a new identity.
  const updatedPlayer =
    player.status === PlayerStatus.CONNECTED
      ? player
      : await prisma.player.update({
          where: { id: player.id },
          data: {
            status: PlayerStatus.CONNECTED,
            lastSeenAt: new Date(),
          },
        });

  const players = await loadActiveRoomPlayers(player.room.id, player.room.hostPlayerId);

  return {
    success: true,
    data: mapRoomSession(player.room, updatedPlayer, players),
  };
}
