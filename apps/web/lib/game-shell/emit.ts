import type { GameActionResponse } from '@wanasatna/shared';
import { getGameShellErrorMessage } from '@/lib/game-shell/error-messages';
import { getRoomSocket } from '@/lib/room/socket';

function isGameActionResponse<T>(value: unknown): value is GameActionResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as { success: unknown }).success === 'boolean'
  );
}

export function emitGameShellWithAck<T>(
  event: string,
  payload?: unknown,
): Promise<GameActionResponse<T>> {
  const socket = getRoomSocket();

  return new Promise((resolve) => {
    socket.timeout(10000).emit(event, payload ?? {}, (error: unknown, response?: unknown) => {
      // Socket.IO timeout acks are (err, value). Some transport paths deliver the
      // payload as the first argument — accept either shape (same as room emitWithAck).
      const resolved = isGameActionResponse<T>(response)
        ? response
        : isGameActionResponse<T>(error)
          ? error
          : undefined;

      if (!resolved) {
        resolve({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: getGameShellErrorMessage('INTERNAL_ERROR'),
          },
        });
        return;
      }

      resolve(resolved);
    });
  });
}
