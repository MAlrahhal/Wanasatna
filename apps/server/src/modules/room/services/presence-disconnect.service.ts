import { PlayerStatus } from '@prisma/client';
import type { Server } from 'socket.io';
import { prisma } from '../../../lib/prisma.js';
import { getPlayerChannel } from '../room.utils.js';
import { handlePlayerDisconnect } from './leave-room.service.js';
import { cancelDisconnectedPlayerExpiry } from './disconnected-player-expiry.service.js';

export async function hasOtherBoundPlayerSocket(
  io: Server,
  playerId: string,
  roomId: string,
  exceptSocketId: string,
): Promise<boolean> {
  const remainingSockets = await io.in(getPlayerChannel(playerId)).fetchSockets();

  return remainingSockets.some(
    (entry) =>
      entry.id !== exceptSocketId &&
      entry.data.playerId === playerId &&
      entry.data.roomId === roomId,
  );
}

export async function restoreConnectedIfDisconnected(
  playerId: string,
  roomId: string,
): Promise<boolean> {
  const result = await prisma.player.updateMany({
    where: {
      id: playerId,
      roomId,
      status: PlayerStatus.DISCONNECTED,
    },
    data: {
      status: PlayerStatus.CONNECTED,
      lastSeenAt: new Date(),
    },
  });

  if (result.count > 0) {
    cancelDisconnectedPlayerExpiry(playerId);
    return true;
  }

  return false;
}

/**
 * Socket disconnect must not win over a concurrent reconnect bind.
 * Recheck the player channel after the DB write; restore CONNECTED if rebound.
 */
export async function applySocketDisconnectPresence(
  io: Server,
  playerId: string,
  roomId: string,
  exceptSocketId: string,
): Promise<'ignored' | 'restored' | 'disconnected'> {
  if (await hasOtherBoundPlayerSocket(io, playerId, roomId, exceptSocketId)) {
    return 'ignored';
  }

  await handlePlayerDisconnect(playerId, roomId);

  if (await hasOtherBoundPlayerSocket(io, playerId, roomId, exceptSocketId)) {
    await restoreConnectedIfDisconnected(playerId, roomId);
    return 'restored';
  }

  return 'disconnected';
}
