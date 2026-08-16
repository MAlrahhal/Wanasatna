import { disconnectRoomSocket } from '@/lib/room/socket';
import { getRoomSessionManager } from '@/lib/room-v2';

const BUSY_ROOM_STATUSES = new Set(['active', 'entering', 'recovering', 'leaving']);

/**
 * After login/register/logout, drop an idle socket so the next Create/Join
 * handshake can send the current account cookie.
 * Must not disconnect while a RoomPlayer session is live.
 */
export function refreshIdleRoomSocketForAccountAuth(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const status = getRoomSessionManager().getState().status;
    if (BUSY_ROOM_STATUSES.has(status)) {
      return;
    }
    disconnectRoomSocket();
  } catch {
    // Account auth must not take down Room identity if the manager is unavailable.
  }
}
