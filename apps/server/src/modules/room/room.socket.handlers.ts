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
  ROOM_PLAYERS_SNAPSHOT_EVENT,
  ROOM_SYNC_EVENT,
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
  syncBoundRoomSession,
  unlockRoom,
} from './room.service.js';
import {
  bindSocketToRoomSession,
  clearSocketSession,
  getSocketContext,
  sendInternalError,
  sendResponse,
} from './room.socket.utils.js';
import {
  broadcastRoomPlayersSnapshot,
  getPlayerChannel,
  getRoomChannel,
  loadActiveRoomPlayers,
} from './room.utils.js';

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

          console.info('[room-join]', {
            roomId: response.data.room.id,
            roomCode: response.data.room.code,
            playerId: response.data.player.id,
          });

          await broadcastRoomPlayersSnapshot(io, response.data.room.id);
        } else {
          console.info('[room-join]', {
            stage: 'failed',
            errorCode: response.error.code,
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
          console.info('[room-leave]', {
            roomId,
            playerId,
            roomDeleted: response.data.roomDeleted,
            hostChanged: Boolean(response.data.hostChanged),
          });

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
              // Clear session before force-disconnect so the disconnect handler
              // does not mark this player DISCONNECTED after a successful reconnect.
              existingSocket.data.playerId = undefined;
              existingSocket.data.roomId = undefined;
              existingSocket.disconnect(true);
            }
          }

          await bindSocketToRoomSession(
            socket,
            response.data.room.id,
            response.data.player.id,
          );

          console.info('[room-reconnect]', {
            roomId: response.data.room.id,
            playerId: response.data.player.id,
            supersededSockets: existingSockets.filter((entry) => entry.id !== socket.id).length,
          });

          // Ack after bind so a later snapshot/recovery failure cannot surface as
          // INTERNAL_ERROR after the player was already reconnected successfully.
          sendResponse(callback, response);

          try {
            await broadcastRoomPlayersSnapshot(io, response.data.room.id);

            ensureGameShellLifecycleProgress(io, response.data.room.id);
            const shell = getGameShellByRoomId(response.data.room.id);

            if (shell) {
              socket.emit(GAME_SHELL_STATE_EVENT, { state: shell });
            }

            await evaluatePlayerRecovery(io, response.data.room.id);
          } catch (error) {
            console.info('[reconnect]', {
              stage: 'post-ack-side-effect-failed',
              errorName: error instanceof Error ? error.name : typeof error,
              errorMessage: error instanceof Error ? error.message : String(error),
            });
          }

          return;
        }

        if (response.hostChanged) {
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

export function registerRoomSyncHandler(_io: Server, socket: Socket): void {
  socket.on(
    ROOM_SYNC_EVENT,
    async (_payload: unknown, callback?: (response: RoomActionResponse<unknown>) => void) => {
      const contextError = getSocketContext(socket);

      if (contextError) {
        // Unbound sockets must use reconnect credentials — sync is for reassert only.
        sendResponse(callback, contextError);
        return;
      }

      const { playerId, roomId } = socket.data;

      try {
        // Re-assert channel membership in case transport recovery dropped it.
        await bindSocketToRoomSession(socket, roomId!, playerId!);
        const response = await syncBoundRoomSession(playerId!, roomId!);

        if (response.success) {
          // CRITICAL: Reload roster immediately before ACK.
          // Concurrent joins can make the roster from syncBoundRoomSession stale by
          // the time we respond. Never ACK a roster older than the live room state.
          // Do NOT room-broadcast on sync — join/leave/disconnect already broadcast;
          // broadcasting here raced and could also stomp clients with ordering issues.
          if (process.env.WANASATNA_TEST_MODE === '1') {
            // Widen the race window so integration tests can land a join between the
            // early sync read and this final reload (production has no artificial delay).
            await new Promise((resolve) => setTimeout(resolve, 80));
          }
          const freshPlayers = await loadActiveRoomPlayers(
            roomId!,
            response.data.room.hostPlayerId,
          );
          response.data = {
            ...response.data,
            players: freshPlayers,
          };

          console.info('[room-sync]', {
            stage: 'bound-sync',
            roomId,
            playerId,
            playerCount: freshPlayers.length,
          });

          // Deliver the same authoritative roster to THIS socket as a snapshot event
          // so listeners stay consistent with the ACK without broadcasting stale data.
          socket.emit(ROOM_PLAYERS_SNAPSHOT_EVENT, { players: freshPlayers });
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

    // Detach this socket immediately so concurrent reconnect bind wins cleanly.
    socket.data.playerId = undefined;
    socket.data.roomId = undefined;

    try {
      const remainingSockets = await io.in(getPlayerChannel(playerId)).fetchSockets();
      const hasOtherActiveSocket = remainingSockets.some(
        (entry) =>
          entry.id !== socket.id &&
          entry.data.playerId === playerId &&
          entry.data.roomId === roomId,
      );

      if (hasOtherActiveSocket) {
        console.info('[room-presence]', {
          stage: 'disconnect-ignored-other-socket',
          roomId,
          playerId,
        });
        return;
      }

      await handlePlayerDisconnect(playerId, roomId);
      console.info('[room-presence]', {
        stage: 'marked-disconnected',
        roomId,
        playerId,
      });
      await broadcastRoomPlayersSnapshot(io, roomId);
      await evaluatePlayerRecovery(io, roomId);
    } catch {
      // Disconnect cleanup should not crash the server.
    }
  });
}
