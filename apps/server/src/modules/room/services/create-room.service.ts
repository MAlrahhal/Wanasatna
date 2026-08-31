import { randomUUID } from 'node:crypto';
import { PlayerStatus, Prisma, RoomStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { opsLogger, sanitizeErrorName, sanitizeKnownErrorCode } from '../../../lib/ops-logger.js';
import {
  ADMIN_ROOM_PLAYER_CAP,
  MAX_ROOM_PLAYERS,
  type RoomActionResponse,
  type RoomSessionData,
  type UserRole,
} from '@wanasatna/shared';
import { validateCreateRoomPayload } from '../room.validators.js';
import { generateUniqueRoomCode, loadActiveRoomPlayers, mapRoomSession } from '../room.utils.js';
import { generateReconnectToken, hashReconnectToken } from '../reconnect-token.js';
import { recordProductEvent } from '../../analytics/product-event.service.js';
import { serviceError } from './shared-room.service.js';

function logCreateRoomDiagnostic(
  stage: string,
  details: Record<string, string | number | boolean | undefined> = {},
): void {
  // TEMP diagnostic — safe fields only (no secrets / tokens / connection strings).
  console.info('[create-room]', { stage, ...details });
}

function playerCapForCreatorRole(role: UserRole | null | undefined): number {
  return role === 'ADMIN' ? ADMIN_ROOM_PLAYER_CAP : MAX_ROOM_PLAYERS;
}

export async function createRoom(
  payload: unknown,
  accountUserId: string | null = null,
  accountRole: UserRole | null = null,
): Promise<RoomActionResponse<RoomSessionData>> {
  logCreateRoomDiagnostic('request-received');

  const validation = validateCreateRoomPayload(payload);

  if (!validation.success) {
    logCreateRoomDiagnostic('validation-failed', {
      code: validation.error.code,
      message: validation.error.message,
    });
    return validation;
  }

  logCreateRoomDiagnostic('validation-ok', {
    playerNameLength: validation.data.playerName.length,
  });

  try {
    logCreateRoomDiagnostic('generating-room-code');
    const code = await generateUniqueRoomCode();
    const roomId = randomUUID();
    const playerId = randomUUID();
    const reconnectToken = generateReconnectToken();
    const reconnectTokenHash = hashReconnectToken(reconnectToken);
    const playerCap = playerCapForCreatorRole(accountRole);

    logCreateRoomDiagnostic('db-transaction-start');
    // Room/Player FKs are DEFERRABLE INITIALLY DEFERRED (migration).
    // Do NOT run SET CONSTRAINTS — Neon/PgBouncer pooled connections reject session SET.
    const room = await prisma.$transaction(async (tx) => {
      logCreateRoomDiagnostic('db-create-player');
      await tx.player.create({
        data: {
          id: playerId,
          roomId,
          name: validation.data.playerName,
          status: PlayerStatus.CONNECTED,
          isSpectator: false,
          reconnectTokenHash,
          userId: accountUserId || null,
        },
      });

      logCreateRoomDiagnostic('db-create-room');
      return tx.room.create({
        data: {
          id: roomId,
          code,
          hostPlayerId: playerId,
          status: RoomStatus.LOBBY,
          isLocked: false,
          playerCap,
        },
        include: { hostPlayer: true },
      });
    });

    const players = await loadActiveRoomPlayers(room.id, room.hostPlayerId);

    logCreateRoomDiagnostic('success', {
      callbackErrorCode: 'none',
      playerCount: players.length,
    });

    await recordProductEvent({
      type: 'ROOM_CREATED',
      roomId: room.id,
      roomCap: room.playerCap,
      playerCount: 1,
    });

    return {
      success: true,
      data: mapRoomSession(room, room.hostPlayer, players, reconnectToken),
    };
  } catch (error) {
    opsLogger.error('room-create-failed', 'تعذر إكمال إنشاء الغرفة.', {
      operation: 'create-room',
      errorName: sanitizeErrorName(error),
      errorCode: sanitizeKnownErrorCode(error),
    });

    if (error instanceof Error && error.message === 'ROOM_CODE_GENERATION_FAILED') {
      logCreateRoomDiagnostic('callback-error', {
        callbackErrorCode: 'ROOM_CODE_GENERATION_FAILED',
      });
      return serviceError(
        'ROOM_CODE_GENERATION_FAILED',
        'Unable to generate a unique room code. Please try again.',
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        logCreateRoomDiagnostic('callback-error', { callbackErrorCode: 'PLAYER_ALREADY_EXISTS' });
        return serviceError(
          'PLAYER_ALREADY_EXISTS',
          'A player with this name already exists in the room.',
        );
      }

      if (error.code === 'P2003' || error.code === 'P2010') {
        logCreateRoomDiagnostic('callback-error', { callbackErrorCode: 'INTERNAL_ERROR' });
        return serviceError('INTERNAL_ERROR', 'Unable to create the room. Please try again.');
      }
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      logCreateRoomDiagnostic('callback-error', { callbackErrorCode: 'INTERNAL_ERROR' });
      return serviceError('INTERNAL_ERROR', 'Unable to create the room. Please try again.');
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      logCreateRoomDiagnostic('callback-error', { callbackErrorCode: 'INTERNAL_ERROR' });
      return serviceError('INTERNAL_ERROR', 'Unable to create the room. Please try again.');
    }

    logCreateRoomDiagnostic('callback-error', {
      callbackErrorCode: 'INTERNAL_ERROR',
      rethrow: true,
    });
    throw error;
  }
}
