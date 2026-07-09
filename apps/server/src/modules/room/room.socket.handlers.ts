import type { Server, Socket } from 'socket.io';
import {
  CREATE_ROOM_EVENT,
  HOST_CHANGED_EVENT,
  JOIN_ROOM_EVENT,
  KICK_PLAYER_EVENT,
  LEAVE_ROOM_EVENT,
  LOCK_ROOM_EVENT,
  PLAYER_KICKED_EVENT,
  RECONNECT_EVENT,
  ROOM_UPDATED_EVENT,
  UNLOCK_ROOM_EVENT,
  type CreateRoomResponse,
  type RoomActionResponse,
} from '@wanasatna/shared';
import {
  createRoom,
  handlePlayerDisconnect,
  joinRoom,
  kickPlayer,
  leaveRoom,
  lockRoom,
  reconnectPlayer,
  unlockRoom,
} from './room.service.js';
import {
  bindSocketToRoomSession,
  clearSocketSession,
  getSocketContext,
  sendInternalError,
  sendResponse,
} from './room.socket.utils.js';
import { getPlayerChannel, getRoomChannel } from './room.utils.js';

export function registerCreateRoomHandler(socket: Socket): void {
  socket.on(
    CREATE_ROOM_EVENT,
    async (payload: unknown, callback?: (response: CreateRoomResponse) => void) => {
      try {
        const response = await createRoom(payload);

        if (response.success) {
          await bindSocketToRoomSession(
            socket,
            response.data.room.id,
            response.data.player.id,
          );
        }

        sendResponse(callback, response);
      } catch {
        sendInternalError(callback);
      }
    },
  );
}

export function registerJoinRoomHandler(socket: Socket): void {
  socket.on(
    JOIN_ROOM_EVENT,
    async (payload: unknown, callback?: (response: RoomActionResponse<unknown>) => void) => {
      try {
        const response = await joinRoom(payload);

        if (response.success) {
          await bindSocketToRoomSession(
            socket,
            response.data.room.id,
            response.data.player.id,
          );

          socket.to(getRoomChannel(response.data.room.id)).emit(JOIN_ROOM_EVENT, {
            player: response.data.player,
          });
        }

        sendResponse(callback, response);
      } catch {
        sendInternalError(callback);
      }
    },
  );
}

export function registerLeaveRoomHandler(io: Server, socket: Socket): void {
  socket.on(
    LEAVE_ROOM_EVENT,
    async (_payload: unknown, callback?: (response: RoomActionResponse<unknown>) => void) => {
      const contextError = getSocketContext(socket);

      if (contextError) {
        sendResponse(callback, contextError);
        return;
      }

      const { playerId, roomId } = socket.data;

      try {
        const response = await leaveRoom(playerId!, roomId!);

        if (response.success) {
          await clearSocketSession(socket);

          if (!response.data.roomDeleted) {
            socket.to(getRoomChannel(roomId!)).emit(LEAVE_ROOM_EVENT, { playerId });

            if (response.data.hostChanged) {
              io.to(getRoomChannel(roomId!)).emit(HOST_CHANGED_EVENT, response.data.hostChanged);
            }
          }
        }

        sendResponse(callback, response);
      } catch {
        sendInternalError(callback);
      }
    },
  );
}

export function registerKickPlayerHandler(io: Server, socket: Socket): void {
  socket.on(
    KICK_PLAYER_EVENT,
    async (payload: unknown, callback?: (response: RoomActionResponse<unknown>) => void) => {
      const contextError = getSocketContext(socket);

      if (contextError) {
        sendResponse(callback, contextError);
        return;
      }

      const { playerId, roomId } = socket.data;

      try {
        const response = await kickPlayer(playerId!, roomId!, payload);

        if (response.success) {
          const roomChannel = getRoomChannel(roomId!);
          const kickedPlayerChannel = getPlayerChannel(response.data.kickedPlayerId);

          io.to(kickedPlayerChannel).emit(PLAYER_KICKED_EVENT, {
            roomId,
            playerId: response.data.kickedPlayerId,
          });

          const kickedSockets = await io.in(kickedPlayerChannel).fetchSockets();

          for (const kickedSocket of kickedSockets) {
            await kickedSocket.leave(roomChannel);
            await kickedSocket.leave(kickedPlayerChannel);
            kickedSocket.data.playerId = undefined;
            kickedSocket.data.roomId = undefined;
          }

          if (!response.data.roomDeleted) {
            socket.to(roomChannel).emit(KICK_PLAYER_EVENT, {
              playerId: response.data.kickedPlayerId,
            });
          }
        }

        sendResponse(callback, response);
      } catch {
        sendInternalError(callback);
      }
    },
  );
}

export function registerLockRoomHandler(io: Server, socket: Socket): void {
  socket.on(
    LOCK_ROOM_EVENT,
    async (_payload: unknown, callback?: (response: RoomActionResponse<unknown>) => void) => {
      const contextError = getSocketContext(socket);

      if (contextError) {
        sendResponse(callback, contextError);
        return;
      }

      const { playerId, roomId } = socket.data;

      try {
        const response = await lockRoom(playerId!, roomId!);

        if (response.success) {
          io.to(getRoomChannel(roomId!)).emit(ROOM_UPDATED_EVENT, response.data);
        }

        sendResponse(callback, response);
      } catch {
        sendInternalError(callback);
      }
    },
  );
}

export function registerUnlockRoomHandler(io: Server, socket: Socket): void {
  socket.on(
    UNLOCK_ROOM_EVENT,
    async (_payload: unknown, callback?: (response: RoomActionResponse<unknown>) => void) => {
      const contextError = getSocketContext(socket);

      if (contextError) {
        sendResponse(callback, contextError);
        return;
      }

      const { playerId, roomId } = socket.data;

      try {
        const response = await unlockRoom(playerId!, roomId!);

        if (response.success) {
          io.to(getRoomChannel(roomId!)).emit(ROOM_UPDATED_EVENT, response.data);
        }

        sendResponse(callback, response);
      } catch {
        sendInternalError(callback);
      }
    },
  );
}

export function registerReconnectHandler(io: Server, socket: Socket): void {
  socket.on(
    RECONNECT_EVENT,
    async (payload: unknown, callback?: (response: RoomActionResponse<unknown>) => void) => {
      try {
        const response = await reconnectPlayer(payload);

        if (response.success) {
          await bindSocketToRoomSession(
            socket,
            response.data.room.id,
            response.data.player.id,
          );
        } else if (response.hostChanged) {
          io.to(getRoomChannel(response.hostChanged.roomId)).emit(
            HOST_CHANGED_EVENT,
            response.hostChanged,
          );
        }

        sendResponse(callback, response);
      } catch {
        sendInternalError(callback);
      }
    },
  );
}

export function registerDisconnectHandler(socket: Socket): void {
  socket.on('disconnect', async () => {
    const { playerId, roomId } = socket.data;

    if (!playerId || !roomId) {
      return;
    }

    try {
      await handlePlayerDisconnect(playerId, roomId);
    } catch {
      // Disconnect cleanup should not crash the server.
    }
  });
}
