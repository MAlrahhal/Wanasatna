import {
  LEAVE_ROOM_EVENT,
  RECONNECT_EVENT,
  type RoomActionResponse,
} from '@wanasatna/shared';
import { getRoomErrorMessage } from '@/lib/room/error-messages';
import {
  findRoomReconnectCredential,
  removeRoomReconnectCredential,
} from '@/lib/room/reconnect-credential';
import { clearRoomSession, readRoomSession } from '@/lib/room/session';
import { disconnectRoomSocket, getRoomSocket, waitForRoomSocketConnection } from '@/lib/room/socket';

type LeaveRoomResponse = { roomDeleted: boolean; hostChanged: unknown | null };

function emitWithAck<T>(
  event: string,
  payload: unknown,
  timeoutMs: number,
): Promise<RoomActionResponse<T>> {
  const socket = getRoomSocket();

  return new Promise((resolve) => {
    socket
      .timeout(timeoutMs)
      .emit(event, payload, (error: unknown, response?: RoomActionResponse<T>) => {
        if (
          response &&
          typeof response === 'object' &&
          'success' in response &&
          typeof response.success === 'boolean'
        ) {
          resolve(response);
          return;
        }

        resolve({
          success: false,
          error: {
            code: 'CONNECTION_FAILED',
            message: getRoomErrorMessage('CONNECTION_FAILED'),
          },
        });
      });
  });
}

/**
 * Leave the active room and destroy local identity.
 * Clears storage immediately so cross-room navigation cannot keep Room A
 * authoritative while a leave ACK is in flight.
 */
export async function leaveActiveRoom(): Promise<{ success: boolean }> {
  const session = readRoomSession();
  const roomCode = session?.roomCode ?? null;
  const credential = roomCode ? findRoomReconnectCredential(roomCode) : null;

  // Immediate client isolation — before any network wait.
  clearRoomSession();
  if (roomCode) {
    removeRoomReconnectCredential(roomCode);
  }

  let success = false;

  try {
    const socket = getRoomSocket();

    if (!socket.connected) {
      socket.connect();
      await waitForRoomSocketConnection(socket, 2000);
    }

    // Rebind briefly so the server leave is authorized after a remount/reload.
    if (session && credential) {
      await emitWithAck(
        RECONNECT_EVENT,
        {
          playerId: credential.playerId,
          roomId: credential.roomId,
          roomCode: credential.roomCode,
          reconnectToken: credential.reconnectToken,
        },
        2000,
      );
    }

    const response = await emitWithAck<LeaveRoomResponse>(LEAVE_ROOM_EVENT, {}, 2000);
    success = response.success;
  } catch {
    success = false;
  }

  disconnectRoomSocket();
  return { success };
}

export function isRoomRoute(pathname: string): boolean {
  return (
    pathname === '/lobby' ||
    pathname === '/game' ||
    pathname.startsWith('/lobby/') ||
    pathname.startsWith('/game/')
  );
}

export function shouldGuardNavigation(hasActiveSession: boolean, targetHref: string): boolean {
  if (!hasActiveSession) {
    return false;
  }

  const path = targetHref.split('?')[0] ?? targetHref;
  return !isRoomRoute(path);
}

export function shouldHideCreateRoomAction(hasActiveSession: boolean): boolean {
  return hasActiveSession;
}

export function canViewRoomInvitationDetails(isHost: boolean): boolean {
  return isHost;
}
