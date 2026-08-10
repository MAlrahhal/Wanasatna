import {
  LEAVE_ROOM_EVENT,
  RECONNECT_EVENT,
  type RoomActionResponse,
} from '@wanasatna/shared';
import { getRoomErrorMessage } from '@/lib/room/error-messages';
import {
  findRoomReconnectCredential,
  purgeLegacyLocalStorageRoomIdentity,
} from '@/lib/room/reconnect-credential';
import { readRoomSession, resetRoomParticipationIdentity } from '@/lib/room/session';
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
 * Leave the active room and destroy local Room participation identity immediately.
 *
 * Client identity is cleared BEFORE the leave ACK so Create/Join cannot reuse it.
 * Does not touch future Account/Auth identity.
 */
export async function leaveActiveRoom(): Promise<{ success: boolean }> {
  purgeLegacyLocalStorageRoomIdentity();

  const session = readRoomSession();
  const roomCode = session?.roomCode ?? null;
  const credential = roomCode ? findRoomReconnectCredential(roomCode) : null;

  // Immediate client isolation — before any network wait.
  resetRoomParticipationIdentity(roomCode ?? undefined);

  let success = false;

  try {
    const socket = getRoomSocket();

    if (!socket.connected) {
      socket.connect();
      await waitForRoomSocketConnection(socket, 2000);
    }

    // Rebind briefly so the server leave is authorized after a remount/reload.
    // Do not apply the reconnect ACK to local storage — identity stays dead.
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
  } finally {
    // Guarantee no residual RoomPlayer identity survives leave (including races
    // where a transient reconnect ACK could have been applied elsewhere).
    resetRoomParticipationIdentity(roomCode ?? undefined);
  }

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
