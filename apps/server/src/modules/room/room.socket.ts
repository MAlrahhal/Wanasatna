import type { Server, Socket } from 'socket.io';
import { CREATE_ROOM_EVENT, type CreateRoomResponse } from './room.types.js';
import { createRoom } from './room.service.js';

function getRoomChannel(roomId: string): string {
  return `room:${roomId}`;
}

function registerCreateRoomHandler(socket: Socket): void {
  socket.on(
    CREATE_ROOM_EVENT,
    async (payload: unknown, callback?: (response: CreateRoomResponse) => void) => {
      try {
        const response = await createRoom(payload);

        if (response.success) {
          socket.data.playerId = response.data.player.id;
          socket.data.roomId = response.data.room.id;
          await socket.join(getRoomChannel(response.data.room.id));
        }

        if (typeof callback === 'function') {
          callback(response);
        }
      } catch {
        const response: CreateRoomResponse = {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to create room. Please try again.',
          },
        };

        if (typeof callback === 'function') {
          callback(response);
        }
      }
    },
  );
}

export function registerRoomSockets(io: Server): void {
  io.on('connection', (socket) => {
    registerCreateRoomHandler(socket);
  });
}
