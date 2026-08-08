import type { Server, Socket } from 'socket.io';
import {
  CREATE_ROOM_EVENT,
  GAME_SHELL_STATE_EVENT,
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
import { getGameShellByRoomId } from '../game/game.service.js';
import { ensureGameShellLifecycleProgress } from '../game/game.lifecycle.js';
import { evaluatePlayerRecovery } from '../game/runtime/player-recovery.js';
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
import { broadcastRoomPlayersSnapshot, getPlayerChannel, getRoomChannel } from './room.utils.js';

export function registerCreateRoomHandler(socket: Socket): void {
  socket.on(
    CREATE_ROOM_EVENT,
    async (payload: unknown, callback?: (response: CreateRoomResponse) => void) => {
      try {
        console.info('[create-room]', { stage: 'socket-handler-received' });
        const response = await createRoom(payload);

        if (response.success) {
          await bindSocketToRoomSession(
            socket,
            response.data.room.id,
            response.data.player.id,
          );
          console.info('[create-room]', {
            stage: 'socket-handler-complete',
            callbackErrorCode: 'none',
          });
        } else {
          console.info('[create-room]', {
            stage: 'socket-handler-complete',
            callbackErrorCode: response.error.code,
          });
        }

        sendResponse(callback, response);
      } catch (error) {
        console.info('[create-room]', {
          stage: 'socket-handler-thrown',
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          callbackErrorCode: 'INTERNAL_ERROR',
        });
        sendInternalError(callback);
      }
    },
  );
}

export function registerJoinRoomHandler(io: Server, socket: Socket): void {
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

          await broadcastRoomPlayersSnapshot(io, response.data.room.id);
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
            if (response.data.hostChanged) {
              io.to(getRoomChannel(roomId!)).emit(HOST_CHANGED_EVENT, response.data.hostChanged);
            }

            await broadcastRoomPlayersSnapshot(io, roomId!);
            await evaluatePlayerRecovery(io, roomId!);
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
            await broadcastRoomPlayersSnapshot(io, roomId!);
            await evaluatePlayerRecovery(io, roomId!);
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
          const playerChannel = getPlayerChannel(response.data.player.id);
          const existingSockets = await io.in(playerChannel).fetchSockets();

          for (const existingSocket of existingSockets) {
            if (existingSocket.id !== socket.id) {
              existingSocket.disconnect(true);
            }
          }

          await bindSocketToRoomSession(
            socket,
            response.data.room.id,
            response.data.player.id,
          );

          await broadcastRoomPlayersSnapshot(io, response.data.room.id);

          ensureGameShellLifecycleProgress(io, response.data.room.id);
          const shell = getGameShellByRoomId(response.data.room.id);

          if (shell) {
            socket.emit(GAME_SHELL_STATE_EVENT, { state: shell });
          }

          await evaluatePlayerRecovery(io, response.data.room.id);
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

export function registerDisconnectHandler(io: Server, socket: Socket): void {
  socket.on('disconnect', async () => {
    const { playerId, roomId } = socket.data;

    if (!playerId || !roomId) {
      return;
    }

    try {
      await handlePlayerDisconnect(playerId, roomId);
      await broadcastRoomPlayersSnapshot(io, roomId);
      await evaluatePlayerRecovery(io, roomId);
    } catch {
      // Disconnect cleanup should not crash the server.
    }
  });
}
