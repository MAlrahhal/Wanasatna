import { PlayerStatus, Prisma, RoomStatus } from '@prisma/client';
import type { RoomActionResponse, RoomGameSettings, UpdateRoomGameSettingsPayload } from '@wanasatna/shared';
import {
  mergeGameSettingPatch,
  sanitizeGameSettingPatch,
  sanitizeRoomGameSettings,
} from '@wanasatna/shared';
import { prisma } from '../../../lib/prisma.js';
import { getGameShellByRoomId } from '../../game/game.service.js';
import { serviceError } from './shared-room.service.js';
import { setRoomGameSettingsCache } from '../room-game-settings.store.js';

export type UpdateRoomGameSettingsResult = RoomActionResponse<{
  roomId: string;
  gameSettings: RoomGameSettings | null;
}>;

export async function updateRoomGameSettings(input: {
  roomId: string;
  playerId: string;
  isAdminSession: boolean;
  payload: UpdateRoomGameSettingsPayload;
}): Promise<UpdateRoomGameSettingsResult> {
  if (!input.isAdminSession) {
    return serviceError('FORBIDDEN', 'غير مصرح لك بتعديل هذه الإعدادات.');
  }

  const room = await prisma.room.findUnique({ where: { id: input.roomId } });
  if (!room) {
    return serviceError('ROOM_NOT_FOUND', 'Room not found.');
  }
  if (room.status === RoomStatus.CLOSED) {
    return serviceError('ROOM_CLOSED', 'This room is closed.');
  }

  const player = await prisma.player.findFirst({
    where: {
      id: input.playerId,
      roomId: input.roomId,
      status: PlayerStatus.CONNECTED,
    },
    select: { id: true },
  });
  if (!player) {
    return serviceError('PLAYER_NOT_FOUND', 'Player not found in this room.');
  }

  if (getGameShellByRoomId(input.roomId) || room.status === RoomStatus.PLAYING) {
    return serviceError('MATCH_IN_PROGRESS', 'لا يمكن تعديل الإعدادات أثناء المباراة.');
  }

  const patch = sanitizeGameSettingPatch(input.payload.gameId, input.payload.settings);
  if (!patch.success) {
    return serviceError('VALIDATION_ERROR', patch.error);
  }

  const current = sanitizeRoomGameSettings(room.gameSettings);
  const merged = mergeGameSettingPatch(current, input.payload.gameId, patch.values);
  const persisted = sanitizeRoomGameSettings(merged);

  await prisma.room.update({
    where: { id: input.roomId },
    data: {
      gameSettings: persisted === null ? Prisma.JsonNull : persisted,
    },
  });

  setRoomGameSettingsCache(input.roomId, persisted);

  return {
    success: true,
    data: {
      roomId: input.roomId,
      gameSettings: persisted,
    },
  };
}
