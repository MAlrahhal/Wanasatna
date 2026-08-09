import { LEAVE_ROOM_EVENT, type RoomActionResponse } from '@wanasatna/shared';
import { getRoomErrorMessage } from '@/lib/room/error-messages';
import { beginNewRoomIdentity, readRoomSession } from '@/lib/room/session';
import { getRoomSocket } from '@/lib/room/socket';

type LeaveRoomResponse = { roomDeleted: boolean; hostChanged: unknown | null };

function emitLeaveRoom(): Promise<RoomActionResponse<LeaveRoomResponse>> {
  const socket = getRoomSocket();

  return new Promise((resolve) => {
    socket.timeout(10000).emit(LEAVE_ROOM_EVENT, {}, (error: unknown, response?: RoomActionResponse<LeaveRoomResponse>) => {
      if (error || !response) {
        resolve({
          success: false,
          error: {
            code: 'CONNECTION_FAILED',
            message: getRoomErrorMessage('CONNECTION_FAILED'),
          },
        });
        return;
      }

      resolve(response);
    });
  });
}

export async function leaveActiveRoom(): Promise<{ success: boolean }> {
  const roomCode = readRoomSession()?.roomCode;
  const response = await emitLeaveRoom();
  beginNewRoomIdentity(roomCode);
  return { success: response.success };
}

export function isRoomRoute(pathname: string): boolean {
  return pathname === '/lobby' || pathname === '/game' || pathname.startsWith('/lobby/') || pathname.startsWith('/game/');
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
