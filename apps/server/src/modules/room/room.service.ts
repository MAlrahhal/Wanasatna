import { PlayerStatus, Prisma, RoomStatus, SessionType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { CreateRoomResponse, CreatedRoomData } from './room.types.js';
import { validateCreateRoomPayload } from './room.validators.js';
import { generateUniqueRoomCode } from './room.utils.js';

function mapCreatedRoom(room: {
  id: string;
  code: string;
  status: RoomStatus;
  isLocked: boolean;
  sessionType: SessionType;
  activeSessionId: string | null;
  createdAt: Date;
  hostPlayer: {
    id: string;
    name: string;
    status: PlayerStatus;
    isSpectator: boolean;
  };
}): CreatedRoomData {
  return {
    room: {
      id: room.id,
      code: room.code,
      status: room.status,
      isLocked: room.isLocked,
      sessionType: room.sessionType,
      activeSessionId: null,
      createdAt: room.createdAt,
    },
    player: {
      id: room.hostPlayer.id,
      name: room.hostPlayer.name,
      status: room.hostPlayer.status,
      isSpectator: room.hostPlayer.isSpectator,
      isHost: true,
    },
  };
}

export async function createRoom(payload: unknown): Promise<CreateRoomResponse> {
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
      data: mapCreatedRoom(room),
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'ROOM_CODE_GENERATION_FAILED') {
      return {
        success: false,
        error: {
          code: 'ROOM_CODE_GENERATION_FAILED',
          message: 'Unable to generate a unique room code. Please try again.',
        },
      };
    }

    throw error;
  }
}
