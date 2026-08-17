import { PlayerStatus, Prisma, type Player, type Room } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import type { RoomActionResponse, RoomSessionData } from '@wanasatna/shared';
import { validateJoinRoomPayload } from '../room.validators.js';
import { loadActiveRoomPlayers, mapRoomSession, MAX_ROOM_PLAYERS } from '../room.utils.js';
import { generateReconnectToken, hashReconnectToken } from '../reconnect-token.js';
import {
  assertRoomNotClosed,
  assertRoomNotLocked,
  findRoomByCode,
  isServiceError,
  serviceError,
  type ServiceError,
} from './shared-room.service.js';
import {
  isRetryableTransactionError,
  lockRoomRow,
  ROOM_TX_RETRY_LIMIT,
} from './room-tx.js';
import { getGameShellByRoomId } from '../../game/game.service.js';

const ACTIVE_STATUSES = [PlayerStatus.CONNECTED, PlayerStatus.DISCONNECTED] as const;

type JoinTxSuccess = {
  success: true;
  room: Room;
  player: Player;
};

type JoinTxResult = JoinTxSuccess | ServiceError;

async function joinRoomInLockedTx(
  tx: Prisma.TransactionClient,
  roomId: string,
  playerName: string,
  reconnectTokenHash: string,
  accountUserId: string | null,
): Promise<JoinTxResult> {
  const roomLocked = await lockRoomRow(tx, roomId);

  if (!roomLocked) {
    return serviceError('ROOM_NOT_FOUND', 'Room not found.');
  }

  const room = await tx.room.findUnique({ where: { id: roomId } });

  if (!room) {
    return serviceError('ROOM_NOT_FOUND', 'Room not found.');
  }

  const closedError = assertRoomNotClosed(room);
  if (closedError) {
    return closedError;
  }

  const lockedError = assertRoomNotLocked(room);
  if (lockedError) {
    return lockedError;
  }

  const activePlayerCount = await tx.player.count({
    where: {
      roomId,
      status: { in: [...ACTIVE_STATUSES] },
    },
  });

  if (activePlayerCount >= MAX_ROOM_PLAYERS) {
    return serviceError('ROOM_FULL', 'الغرفة ممتلئة (الحد الأقصى 8 لاعبين).');
  }

  const existingPlayer = await tx.player.findUnique({
    where: {
      roomId_name: {
        roomId,
        name: playerName,
      },
    },
  });

  if (existingPlayer) {
    if (existingPlayer.status !== PlayerStatus.LEFT) {
      return serviceError(
        'PLAYER_ALREADY_EXISTS',
        'A player with this name already exists in the room.',
      );
    }

    await tx.player.delete({
      where: { id: existingPlayer.id },
    });
  }

  const player = await tx.player.create({
    data: {
      roomId,
      name: playerName,
      status: PlayerStatus.CONNECTED,
      isSpectator: getGameShellByRoomId(roomId) !== null,
      reconnectTokenHash,
      userId: accountUserId || null,
    },
  });

  return {
    success: true,
    room,
    player,
  };
}

export async function joinRoom(
  payload: unknown,
  accountUserId: string | null = null,
): Promise<RoomActionResponse<RoomSessionData>> {
  const validation = validateJoinRoomPayload(payload);

  if (!validation.success) {
    return validation;
  }

  const roomResult = await findRoomByCode(validation.data.roomCode);

  if (isServiceError(roomResult)) {
    return roomResult;
  }

  const reconnectToken = generateReconnectToken();
  const reconnectTokenHash = hashReconnectToken(reconnectToken);
  let lastError: unknown;

  for (let attempt = 0; attempt < ROOM_TX_RETRY_LIMIT; attempt += 1) {
    try {
      const result = await prisma.$transaction((tx) =>
        joinRoomInLockedTx(
          tx,
          roomResult.id,
          validation.data.playerName,
          reconnectTokenHash,
          accountUserId || null,
        ),
      );

      if (!result.success) {
        return result;
      }

      const players = await loadActiveRoomPlayers(result.room.id, result.room.hostPlayerId);

      return {
        success: true,
        data: mapRoomSession(result.room, result.player, players, reconnectToken),
      };
    } catch (error) {
      lastError = error;

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return serviceError(
          'PLAYER_ALREADY_EXISTS',
          'A player with this name already exists in the room.',
        );
      }

      if (!isRetryableTransactionError(error) || attempt === ROOM_TX_RETRY_LIMIT - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}
