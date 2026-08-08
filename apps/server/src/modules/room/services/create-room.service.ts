import { randomUUID } from 'node:crypto';
import { PlayerStatus, Prisma, RoomStatus, SessionType } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import type { RoomActionResponse, RoomSessionData } from '@wanasatna/shared';
import { validateCreateRoomPayload } from '../room.validators.js';
import { generateUniqueRoomCode, mapRoomSession } from '../room.utils.js';
import { generateReconnectToken, hashReconnectToken } from '../reconnect-token.js';
import { serviceError } from './shared-room.service.js';

function logCreateRoomDiagnostic(
  stage: string,
  details: Record<string, string | number | boolean | undefined> = {},
): void {
  // TEMP diagnostic — safe fields only (no secrets / tokens / connection strings).
  console.info('[create-room]', { stage, ...details });
}

export async function createRoom(payload: unknown): Promise<RoomActionResponse<RoomSessionData>> {
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
          sessionType: SessionType.SINGLE_GAME,
        },
        include: { hostPlayer: true },
      });
    });

    logCreateRoomDiagnostic('success', { callbackErrorCode: 'none' });
    return {
      success: true,
      data: mapRoomSession(room, room.hostPlayer, undefined, reconnectToken),
    };
  } catch (error) {
    const prismaCode =
      error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
    const errorName = error instanceof Error ? error.name : typeof error;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logCreateRoomDiagnostic('db-error', {
      errorName,
      errorMessage,
      prismaCode,
    });

    if (error instanceof Error && error.message === 'ROOM_CODE_GENERATION_FAILED') {
      logCreateRoomDiagnostic('callback-error', { callbackErrorCode: 'ROOM_CODE_GENERATION_FAILED' });
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
      return serviceError(
        'INTERNAL_ERROR',
        'Unable to connect to the database. Please try again later.',
      );
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      logCreateRoomDiagnostic('callback-error', { callbackErrorCode: 'INTERNAL_ERROR' });
      return serviceError('INTERNAL_ERROR', 'Unable to create the room. Please try again.');
    }

    logCreateRoomDiagnostic('callback-error', { callbackErrorCode: 'INTERNAL_ERROR', rethrow: true });
    throw error;
  }
}
