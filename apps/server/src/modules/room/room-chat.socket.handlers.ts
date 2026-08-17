import type { Server, Socket } from 'socket.io';
import {
  ROOM_CHAT_MESSAGE_EVENT,
  ROOM_CHAT_SEND_EVENT,
  ROOM_CHAT_SYNC_EVENT,
  type RoomActionResponse,
  type RoomChatHistoryData,
  type RoomChatSendData,
} from '@wanasatna/shared';
import { consumeChatLimit } from '../../lib/abuse-limiter.js';
import { rateLimitedRoomError } from './room-abuse.js';
import { getSocketContext, sendInternalError, sendResponse } from './room.socket.utils.js';
import { getRoomChannel } from './room.utils.js';
import { loadRoomChatHistory, sendRoomChatMessage } from './services/room-chat.service.js';

export function registerRoomChatHandlers(io: Server, socket: Socket): void {
  socket.on(
    ROOM_CHAT_SEND_EVENT,
    async (payload: unknown, callback?: (response: RoomActionResponse<RoomChatSendData>) => void) => {
      const contextError = getSocketContext(socket);

      if (contextError) {
        sendResponse(callback, contextError);
        return;
      }

      if (!consumeChatLimit(socket)) {
        sendResponse(callback, rateLimitedRoomError());
        return;
      }

      const { playerId, roomId } = socket.data;

      try {
        const response = await sendRoomChatMessage(roomId!, playerId!, payload);

        if (response.success) {
          io.to(getRoomChannel(roomId!)).emit(ROOM_CHAT_MESSAGE_EVENT, response.data.message);
        }

        sendResponse(callback, response);
      } catch {
        sendInternalError(callback);
      }
    },
  );

  socket.on(
    ROOM_CHAT_SYNC_EVENT,
    async (_payload: unknown, callback?: (response: RoomActionResponse<RoomChatHistoryData>) => void) => {
      const contextError = getSocketContext(socket);

      if (contextError) {
        sendResponse(callback, contextError);
        return;
      }

      const { playerId, roomId } = socket.data;

      try {
        const response = await loadRoomChatHistory(roomId!, playerId!);
        sendResponse(callback, response);
      } catch {
        sendInternalError(callback);
      }
    },
  );
}
