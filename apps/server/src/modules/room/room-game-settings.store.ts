import type { RoomGameSettings } from '@wanasatna/shared';
import { sanitizeRoomGameSettings } from '@wanasatna/shared';
import { prisma } from '../../lib/prisma.js';

const settingsByRoomId = new Map<string, RoomGameSettings | null>();

export function getRoomGameSettings(roomId: string): RoomGameSettings | null {
  return settingsByRoomId.get(roomId) ?? null;
}

export function setRoomGameSettingsCache(
  roomId: string,
  settings: RoomGameSettings | null,
): void {
  settingsByRoomId.set(roomId, settings);
}

export function clearRoomGameSettingsCache(roomId?: string): void {
  if (roomId) {
    settingsByRoomId.delete(roomId);
    return;
  }
  settingsByRoomId.clear();
}

export async function hydrateRoomGameSettings(roomId: string): Promise<RoomGameSettings | null> {
  const row = await prisma.room.findUnique({
    where: { id: roomId },
    select: { gameSettings: true },
  });
  const sanitized = sanitizeRoomGameSettings(row?.gameSettings ?? null);
  settingsByRoomId.set(roomId, sanitized);
  return sanitized;
}
