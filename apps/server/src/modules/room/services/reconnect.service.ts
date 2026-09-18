import { PlayerStatus, Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import type { ReconnectResponse } from '@wanasatna/shared';
import { verifyReconnectToken } from '../reconnect-token.js';
import { validateReconnectPayload } from '../room.validators.js';
import { isReconnectExpired, loadActiveRoomPlayers, mapRoomSession } from '../room.utils.js';
import { recordProductEvent } from '../../analytics/product-event.service.js';
import {
  cancelDisconnectedPlayerExpiry,
  expireDisconnectedPlayer,
} from './disconnected-player-expiry.service.js';
import { assertRoomNotClosed, serviceError } from './shared-room.service.js';

type ReconnectablePlayer = Prisma.PlayerGetPayload<{ include: { room: true } }>;

/** Exact status/timestamp matching prevents reconnect from reviving a seat expiry already claimed. */
async function claimPlayerConnected(
  initial: ReconnectablePlayer,
): Promise<ReconnectablePlayer | null> {
  let candidate = initial;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (
      candidate.status === PlayerStatus.LEFT ||
      (candidate.status === PlayerStatus.DISCONNECTED && isReconnectExpired(candidate.lastSeenAt))
    ) {
      return null;
    }

    const reconnectedAt = new Date();
    const claimed = await prisma.player.updateMany({
      where: {
        id: candidate.id,
        roomId: candidate.roomId,
        status: candidate.status,
        lastSeenAt: candidate.lastSeenAt,
      },
      data: {
        status: PlayerStatus.CONNECTED,
        lastSeenAt: reconnectedAt,
      },
    });

    if (claimed.count === 1) {
      cancelDisconnectedPlayerExpiry(candidate.id);
      return {
        ...candidate,
        status: PlayerStatus.CONNECTED,
        lastSeenAt: reconnectedAt,
      };
    }

    const latest = await prisma.player.findUnique({
      where: { id: candidate.id },
      include: { room: true },
    });
    if (!latest) {
      return null;
    }
    candidate = latest;
  }

  return null;
}

async function successfulReconnect(
  player: ReconnectablePlayer,
  reconnectToken: string,
): Promise<ReconnectResponse | null> {
  const closedError = assertRoomNotClosed(player.room);
  if (closedError) {
    return closedError;
  }

  const updatedPlayer = await claimPlayerConnected(player);
  if (!updatedPlayer) {
    return null;
  }

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

function reconnectExpiredResponse(input: {
  roomId: string;
  roomDeleted: boolean;
}): ReconnectResponse {
  return {
    success: false,
    error: {
      code: 'RECONNECT_EXPIRED',
      message: 'Reconnect window has expired.',
    },
    hostChanged: null,
    expiredRoomId: input.roomId,
    roomDeleted: input.roomDeleted,
  } as ReconnectResponse;
}

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
      return reconnectExpiredResponse({ roomId: player.roomId, roomDeleted: !latest });
    }

    if (latest.status === PlayerStatus.DISCONNECTED && isReconnectExpired(latest.lastSeenAt)) {
      return reconnectExpiredResponse({ roomId: player.roomId, roomDeleted: false });
    }

    const response = await successfulReconnect(latest, reconnectToken);
    return response ?? reconnectExpiredResponse({ roomId: player.roomId, roomDeleted: false });
  }

  const response = await successfulReconnect(player, reconnectToken);
  return response ?? reconnectExpiredResponse({ roomId: player.roomId, roomDeleted: false });
}
