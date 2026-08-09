import {
  RECONNECT_EVENT,
  ROOM_SYNC_EVENT,
  type RoomActionResponse,
  type RoomSessionData,
} from '@wanasatna/shared';

import { findRoomReconnectCredential } from '@/lib/room/reconnect-credential';
import { readRoomSession } from '@/lib/room/session';
import { getRoomSocket, waitForRoomSocketConnection } from '@/lib/room/socket';

type SessionListener = (data: RoomSessionData) => void;

let sessionListener: SessionListener | null = null;
let resumeInFlight: Promise<RoomSessionData | null> | null = null;

export function setRoomSessionResumeListener(listener: SessionListener | null): void {
  sessionListener = listener;
}

function emitWithAck<T>(event: string, payload: unknown): Promise<RoomActionResponse<T>> {
  const socket = getRoomSocket();

  return new Promise((resolve) => {
    socket.timeout(10000).emit(event, payload, (error: Error | null, response: unknown) => {
      if (error) {
        resolve({
          success: false,
          error: { code: 'CONNECTION_FAILED', message: error.message },
        });
        return;
      }

      if (
        typeof response === 'object' &&
        response !== null &&
        'success' in response &&
        typeof (response as { success: unknown }).success === 'boolean'
      ) {
        resolve(response as RoomActionResponse<T>);
        return;
      }

      resolve({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Invalid server response.' },
      });
    });
  });
}

/**
 * Re-binds the singleton socket to the stored room identity without React.
 * Safe across RoomProvider remount gaps (/lobby ↔ /game) and manager reconnects.
 */
export async function rebindRoomSocketFromStoredSession(): Promise<RoomSessionData | null> {
  if (resumeInFlight) {
    return resumeInFlight;
  }

  resumeInFlight = (async () => {
    const storedSession = readRoomSession();

    if (!storedSession) {
      return null;
    }

    const credential = findRoomReconnectCredential(storedSession.roomCode);

    if (!credential || credential.playerId !== storedSession.playerId) {
      return null;
    }

    const socket = getRoomSocket();

    try {
      if (!socket.connected) {
        socket.connect();
        await waitForRoomSocketConnection(socket);
      }
    } catch {
      return null;
    }

    // Prefer lightweight sync when the server still has this socket bound.
    const syncResponse = await emitWithAck<RoomSessionData>(ROOM_SYNC_EVENT, {});

    if (syncResponse.success) {
      sessionListener?.(syncResponse.data);
      console.info('[room-sync]', { stage: 'client-bound-sync', roomId: storedSession.roomId });
      return syncResponse.data;
    }

    const reconnectResponse = await emitWithAck<RoomSessionData>(RECONNECT_EVENT, {
      playerId: credential.playerId,
      roomId: credential.roomId,
      roomCode: credential.roomCode,
      reconnectToken: credential.reconnectToken,
    });

    if (reconnectResponse.success) {
      sessionListener?.(reconnectResponse.data);
      console.info('[room-sync]', { stage: 'client-reconnect-rebind', roomId: storedSession.roomId });
      return reconnectResponse.data;
    }

    console.info('[room-sync]', {
      stage: 'client-rebind-failed',
      code: reconnectResponse.error.code,
    });
    return null;
  })();

  try {
    return await resumeInFlight;
  } finally {
    resumeInFlight = null;
  }
}
