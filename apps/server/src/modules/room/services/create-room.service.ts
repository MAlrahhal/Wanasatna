import { PlayerStatus, Prisma, RoomStatus, SessionType } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import type { RoomActionResponse, RoomSessionData } from '@wanasatna/shared';
import { validateCreateRoomPayload } from '../room.validators.js';
import { generateUniqueRoomCode, mapRoomSession } from '../room.utils.js';
import { serviceError } from './shared-room.service.js';

export async function createRoom(payload: unknown): Promise<RoomActionResponse<RoomSessionData>> {
  const validation = validateCreateRoomPayload(payload);

  if (!validation.success) {
    return validation;
  }

  try {
    const code = await generateUniqueRoomCode();

    const room = await prisma.room.create({
      data: {
        code,
        status: RoomStatus.LOBBY,
        isLocked: false,
        sessionType: SessionType.SINGLE_GAME,
        hostPlayer: {
          create: {
            name: validation.data.playerName,
            status: PlayerStatus.CONNECTED,
            isSpectator: false,
          } as Prisma.PlayerCreateWithoutHostedRoomInput,
        },
      },
      include: { hostPlayer: true },
    });

    return {
      success: true,
      data: mapRoomSession(room, room.hostPlayer),
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'ROOM_CODE_GENERATION_FAILED') {
      return serviceError(
        'ROOM_CODE_GENERATION_FAILED',
        'Unable to generate a unique room code. Please try again.',
      );
    }

    throw error;
  }
}
