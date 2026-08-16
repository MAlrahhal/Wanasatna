import type { Socket } from 'socket.io';
import type { GameActionResponse, ReconnectResponse, RoomActionResponse } from '@wanasatna/shared';
import {
  RATE_LIMITED_USER_MESSAGE,
  ROOM_ENTRY_IN_PROGRESS_USER_MESSAGE,
} from '../../lib/abuse-limiter.js';

export function rateLimitedRoomError(): Extract<RoomActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: RATE_LIMITED_USER_MESSAGE,
    },
  };
}

export function roomEntryBusyError(): Extract<RoomActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: {
      code: 'ROOM_ENTRY_IN_PROGRESS',
      message: ROOM_ENTRY_IN_PROGRESS_USER_MESSAGE,
    },
  };
}

export function rateLimitedGameError(): Extract<GameActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: RATE_LIMITED_USER_MESSAGE,
    },
  };
}

export function connectionFailedRoomError(): Extract<
  RoomActionResponse<never>,
  { success: false }
> {
  return {
    success: false,
    error: {
      code: 'CONNECTION_FAILED',
      message: 'تعذر إكمال الدخول للغرفة. حاول مرة ثانية.',
    },
  };
}

export function toPublicReconnectFailure(
  response: Extract<ReconnectResponse, { success: false }>,
): Extract<ReconnectResponse, { success: false }> {
  if (response.error.code !== 'PLAYER_NOT_FOUND') {
    return response;
  }

  return {
    ...response,
    error: {
      code: 'RECONNECT_INVALID_TOKEN',
      message: 'Reconnect credential is invalid or expired.',
    },
  };
}

export async function bindNewIdentityOrAbandon(
  socket: Socket,
  roomId: string,
  playerId: string,
  bind: (socket: Socket, roomId: string, playerId: string) => Promise<void>,
  abandon: (playerId: string, roomId: string) => Promise<unknown>,
  clearSession: (socket: Socket) => Promise<void>,
): Promise<'bound' | 'abandoned'> {
  if (!socket.connected) {
    await abandon(playerId, roomId);
    return 'abandoned';
  }

  await bind(socket, roomId, playerId);

  if (!socket.connected) {
    await clearSession(socket);
    await abandon(playerId, roomId);
    return 'abandoned';
  }

  return 'bound';
}
