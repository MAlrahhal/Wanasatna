import type { GameActionResponse } from '@wanasatna/shared';
import { getGameShellErrorMessage } from '@/lib/game-shell/error-messages';
import { getRoomSocket } from '@/lib/room/socket';

export function emitPluginWithAck<T>(
  event: string,
  payload?: unknown,
): Promise<GameActionResponse<T>> {
  const socket = getRoomSocket();

  return new Promise((resolve) => {
    socket.timeout(10000).emit(event, payload ?? {}, (error: unknown, response?: GameActionResponse<T>) => {
      if (error || !response) {
        resolve({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: getGameShellErrorMessage('INTERNAL_ERROR'),
          },
        });
        return;
      }

      if (!response.success) {
        resolve({
          success: false,
          error: {
            code: response.error.code,
            message: getGameShellErrorMessage(response.error.code, response.error.message),
          },
        });
        return;
      }

      resolve(response);
    });
  });
}
