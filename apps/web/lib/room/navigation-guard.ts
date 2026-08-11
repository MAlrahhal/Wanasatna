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
import { suspendRoomResume } from '@/lib/room/participation';
import {
  clearLocalRoomParticipationStorage,
  readRoomSession,
  resetRoomParticipationIdentity,
} from '@/lib/room/session';
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
 * Prefer leaving on the still-bound socket (no reconnect) to avoid Room A resurrection noise.
 * Does not touch future Account/Auth identity.
 */
export async function leaveActiveRoom(): Promise<{ success: boolean }> {
  purgeLegacyLocalStorageRoomIdentity();

  const session = readRoomSession();
  const roomCode = session?.roomCode ?? null;
  const credential = roomCode ? findRoomReconnectCredential(roomCode) : null;
  const socket = getRoomSocket();
  const wasConnected = socket.connected;

  // Immediate client isolation — storage cleared, resume blocked, socket kept if bound.
  suspendRoomResume();
  clearLocalRoomParticipationStorage(roomCode ?? undefined);

  let success = false;

  try {
    if (!wasConnected) {
      socket.connect();
      await waitForRoomSocketConnection(socket, 2000);

      // Only rebind when the socket was already down (e.g. remount/reload leave).
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
    }

    const response = await emitWithAck<LeaveRoomResponse>(LEAVE_ROOM_EVENT, {}, 2000);
    success = response.success;
  } catch {
    success = false;
  } finally {
    // Teardown socket + guarantee no residual RoomPlayer identity.
    resetRoomParticipationIdentity(roomCode ?? undefined);
    suspendRoomResume();
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
