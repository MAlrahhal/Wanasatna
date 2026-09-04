import { RoomStatus } from '@prisma/client';
import { findRoomByCode, isServiceError } from './shared-room.service.js';

/**
 * Read-only check for whether a live room still exists and can be returned to.
 * Does not authorize reconnect; closed or missing rooms are not returnable.
 */
export async function isRoomCurrentlyReturnable(roomCode: string): Promise<boolean> {
  const room = await findRoomByCode(roomCode);
  if (isServiceError(room)) {
    return false;
  }

  return room.status !== RoomStatus.CLOSED;
}
