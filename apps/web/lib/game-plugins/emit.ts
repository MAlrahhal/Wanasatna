import type { GameActionResponse } from '@wanasatna/shared';
import { localizePluginAck, resolveGameAck } from '@/lib/socket/ack-response';
import { getRoomSocket } from '@/lib/room/socket';

export function emitPluginWithAck<T>(
  event: string,
  payload?: unknown,
): Promise<GameActionResponse<T>> {
  const socket = getRoomSocket();

  return new Promise((resolve) => {
    socket.timeout(10000).emit(event, payload ?? {}, (error: unknown, response?: unknown) => {
      resolve(localizePluginAck(resolveGameAck<T>(error, response)));
    });
  });
}
