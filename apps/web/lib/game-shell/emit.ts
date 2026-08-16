import type { GameActionResponse } from '@wanasatna/shared';
import { resolveGameAck } from '@/lib/socket/ack-response';
import { getRoomSocket } from '@/lib/room/socket';

export function emitGameShellWithAck<T>(
  event: string,
  payload?: unknown,
): Promise<GameActionResponse<T>> {
  const socket = getRoomSocket();

  return new Promise((resolve) => {
    socket.timeout(10000).emit(event, payload ?? {}, (error: unknown, response?: unknown) => {
      resolve(resolveGameAck<T>(error, response));
    });
  });
}
