import type { RoomActionResponse } from '@wanasatna/shared';
import { getRoomErrorMessage } from '@/lib/room/error-messages';
import { getRoomSocket } from '@/lib/room/socket';

function isRoomActionResponse<T>(value: unknown): value is RoomActionResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as { success: unknown }).success === 'boolean'
  );
}

export function emitRoomAck<T>(
  event: string,
  payload?: unknown,
  timeoutMs = 10_000,
): Promise<RoomActionResponse<T>> {
  const socket = getRoomSocket();

  return new Promise((resolve) => {
    socket.timeout(timeoutMs).emit(event, payload ?? {}, (error: unknown, response?: RoomActionResponse<T>) => {
      const resolved = isRoomActionResponse<T>(response)
        ? response
        : isRoomActionResponse<T>(error)
          ? error
          : undefined;

      if (!resolved) {
        resolve({
          success: false,
          error: {
            code: 'CONNECTION_FAILED',
            message: getRoomErrorMessage('CONNECTION_FAILED'),
          },
        });
        return;
      }

      resolve(resolved);
    });
  });
}
