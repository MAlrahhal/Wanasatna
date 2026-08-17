import { PlayerStatus, type RoomMessage } from '@prisma/client';
import type {
  RoomActionResponse,
  RoomChatHistoryData,
  RoomChatMessage,
  RoomChatSendData,
} from '@wanasatna/shared';
import { ROOM_CHAT_HISTORY_LIMIT } from '@wanasatna/shared';
import { prisma } from '../../../lib/prisma.js';
import { serviceError } from './shared-room.service.js';
import { validateSendRoomChatPayload } from '../room.validators.js';

function toChatMessage(row: RoomMessage): RoomChatMessage {
  return {
    id: row.id,
    senderName: row.senderNameSnapshot,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    playerId: row.playerId,
  };
}

async function loadSeatInRoom(playerId: string, roomId: string) {
  return prisma.player.findFirst({
    where: { id: playerId, roomId },
    select: { id: true, name: true, status: true, roomId: true },
  });
}

export async function sendRoomChatMessage(
  roomId: string,
  playerId: string,
  payload: unknown,
): Promise<RoomActionResponse<RoomChatSendData>> {
  const validation = validateSendRoomChatPayload(payload);

  if (!validation.success) {
    return validation;
  }

  try {
    const player = await loadSeatInRoom(playerId, roomId);

    if (!player || player.roomId !== roomId) {
      return serviceError('PLAYER_NOT_FOUND', 'Player not found in this room.');
    }

    if (player.status !== PlayerStatus.CONNECTED) {
      return serviceError('PLAYER_NOT_FOUND', 'Player not found in this room.');
    }

    const row = await prisma.roomMessage.create({
      data: {
        roomId,
        playerId: player.id,
        senderNameSnapshot: player.name,
        content: validation.data.content,
      },
    });

    return {
      success: true,
      data: { message: toChatMessage(row) },
    };
  } catch {
    return serviceError('INTERNAL_ERROR', 'تعذر إرسال الرسالة. حاول مرة ثانية.');
  }
}

export async function loadRoomChatHistory(
  roomId: string,
  playerId: string,
): Promise<RoomActionResponse<RoomChatHistoryData>> {
  try {
    const player = await loadSeatInRoom(playerId, roomId);

    if (!player || player.roomId !== roomId) {
      return serviceError('PLAYER_NOT_FOUND', 'Player not found in this room.');
    }

    if (
      player.status !== PlayerStatus.CONNECTED &&
      player.status !== PlayerStatus.DISCONNECTED
    ) {
      return serviceError('PLAYER_NOT_FOUND', 'Player not found in this room.');
    }

    const rows = await prisma.roomMessage.findMany({
      where: { roomId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: ROOM_CHAT_HISTORY_LIMIT,
    });

    return {
      success: true,
      data: { messages: rows.reverse().map(toChatMessage) },
    };
  } catch {
    return serviceError('INTERNAL_ERROR', 'تعذر تحميل الدردشة. حاول مرة ثانية.');
  }
}
