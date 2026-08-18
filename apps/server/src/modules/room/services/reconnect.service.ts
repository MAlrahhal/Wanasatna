import { PlayerStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import type { ReconnectResponse } from '@wanasatna/shared';
import { verifyReconnectToken } from '../reconnect-token.js';
import { validateReconnectPayload } from '../room.validators.js';
import { isReconnectExpired, loadActiveRoomPlayers, mapRoomSession } from '../room.utils.js';
import { recordProductEvent } from '../../analytics/product-event.service.js';
import { expireDisconnectedPlayer } from './disconnected-player-expiry.service.js';
import { assertRoomNotClosed, serviceError } from './shared-room.service.js';

export async function reconnectPlayer(payload: unknown): Promise<ReconnectResponse> {
  const validation = validateReconnectPayload(payload);

  if (!validation.success) {
    return validation;
  }

  const { playerId, reconnectToken, roomCode, roomId } = validation.data;

  if (!roomCode && !roomId) {
    return serviceError('VALIDATION_ERROR', 'Room code or room ID is required for reconnect.');
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { room: true },
  });

  if (!player) {
    return serviceError('PLAYER_NOT_FOUND', 'Player not found.');
  }

  if (roomId && player.roomId !== roomId) {
    return serviceError('RECONNECT_INVALID_TOKEN', 'Reconnect credential does not match this room.');
  }

  if (roomCode && player.room.code !== roomCode) {
    return serviceError('RECONNECT_INVALID_TOKEN', 'Reconnect credential does not match this room.');
  }

  if (!verifyReconnectToken(reconnectToken, player.reconnectTokenHash)) {
    return serviceError('RECONNECT_INVALID_TOKEN', 'Reconnect credential is invalid or expired.');
  }

  if (player.status === PlayerStatus.LEFT) {
    return serviceError('PLAYER_NOT_FOUND', 'Player session has ended.');
  }

  if (player.status === PlayerStatus.DISCONNECTED && isReconnectExpired(player.lastSeenAt)) {
    const expired = await expireDisconnectedPlayer(player.id, player.roomId);

    if (expired) {
      return {
        success: false,
        error: {
          code: 'RECONNECT_EXPIRED',
          message: 'Reconnect window has expired.',
        },
        hostChanged: expired.hostChanged,
        expiredRoomId: expired.roomId,
        roomDeleted: expired.roomDeleted,
      } as ReconnectResponse;
    }

    const latest = await prisma.player.findUnique({
      where: { id: player.id },
      include: { room: true },
    });

    if (!latest || latest.status === PlayerStatus.LEFT) {
      return {
        success: false,
        error: {
          code: 'RECONNECT_EXPIRED',
          message: 'Reconnect window has expired.',
        },
        hostChanged: null,
        expiredRoomId: player.roomId,
        roomDeleted: !latest,
      } as ReconnectResponse;
    }

    if (latest.status === PlayerStatus.DISCONNECTED && isReconnectExpired(latest.lastSeenAt)) {
      return {
        success: false,
        error: {
          code: 'RECONNECT_EXPIRED',
          message: 'Reconnect window has expired.',
        },
        hostChanged: null,
        expiredRoomId: player.roomId,
        roomDeleted: false,
      } as ReconnectResponse;
    }

    const closedError = assertRoomNotClosed(latest.room);

    if (closedError) {
      return closedError;
    }

    const updatedPlayer = await prisma.player.update({
      where: { id: latest.id },
      data: {
        status: PlayerStatus.CONNECTED,
        lastSeenAt: new Date(),
        // Seat resume only — do not attach or change account linkage.
      },
    });

    const players = await loadActiveRoomPlayers(latest.room.id, latest.room.hostPlayerId);

    await recordProductEvent({
      type: 'RECONNECT_SUCCEEDED',
      roomId: latest.room.id,
      roomCap: latest.room.playerCap,
      playerCount: players.length,
    });

    return {
      success: true,
      data: mapRoomSession(latest.room, updatedPlayer, players, reconnectToken),
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
      // Seat resume only — do not attach or change account linkage.
    },
  });

  const players = await loadActiveRoomPlayers(player.room.id, player.room.hostPlayerId);

  await recordProductEvent({
    type: 'RECONNECT_SUCCEEDED',
    roomId: player.room.id,
    roomCap: player.room.playerCap,
    playerCount: players.length,
  });

  return {
    success: true,
    data: mapRoomSession(player.room, updatedPlayer, players, reconnectToken),
  };
}
