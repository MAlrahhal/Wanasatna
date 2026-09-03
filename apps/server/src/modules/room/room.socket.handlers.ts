import type { Server, Socket } from 'socket.io';
import {
  CREATE_ROOM_EVENT,
  END_ROOM_EVENT,
  GAME_SHELL_STATE_EVENT,
  HOST_CHANGED_EVENT,
  JOIN_ROOM_EVENT,
  KICK_PLAYER_EVENT,
  LEAVE_ROOM_EVENT,
  LOCK_ROOM_EVENT,
  RECONNECT_EVENT,
  ROOM_PLAYERS_SNAPSHOT_EVENT,
  ROOM_SYNC_EVENT,
  ROOM_UPDATED_EVENT,
  UNLOCK_ROOM_EVENT,
  UPDATE_ROOM_GAME_SETTINGS_EVENT,
  UPDATE_PLAYER_AVATAR_EVENT,
  ROOM_GAME_SETTINGS_UPDATED_EVENT,
  type CreateRoomResponse,
  type ReconnectResponse,
  type RoomActionResponse,
  isActiveShellPhase,
} from '@wanasatna/shared';
import { resolveSocketAccountUser } from '../auth/socket-auth.js';
import { getGameShellByRoomId } from '../game/game.service.js';
import { ensureGameShellLifecycleProgress } from '../game/game.lifecycle.js';
import { evaluatePlayerRecovery } from '../game/runtime/player-recovery.js';
import {
  consumeCreateRoomLimit,
  consumeJoinRoomLimit,
  consumeReconnectLimit,
  consumeRoomSyncLimit,
  forgetSocketAbuseState,
} from '../../lib/abuse-limiter.js';
import { opsLogger, sanitizeErrorName, sanitizeKnownErrorCode } from '../../lib/ops-logger.js';
import { announcePermanentPlayerRemoval } from './services/disconnected-player-expiry.service.js';
import { announceKickedPlayer, announceRoomClosed } from './room-socket-announce.js';
import { endRoomByHost } from './services/end-room.service.js';
import { applySocketDisconnectPresence } from './services/presence-disconnect.service.js';
import { transferHostIfCurrentHostDisconnected } from './services/host.service.js';
import {
  kickPlayer,
  lockRoom,
  unlockRoom,
  updateRoomGameSettings,
} from './room.service.js';
import { roomMutationRuntime } from './room-mutation-runtime.js';
import {
  bindNewIdentityOrAbandon,
  connectionFailedRoomError,
  rateLimitedRoomError,
  roomEntryBusyError,
  toPublicReconnectFailure,
} from './room-abuse.js';
import { endRoomEntry, tryBeginRoomEntry } from './room-entry-lock.js';
import {
  clearSocketSession,
  getSocketContext,
  sendInternalError,
  sendResponse,
} from './room.socket.utils.js';
import { broadcastRoomPlayersSnapshot, getPlayerChannel, getRoomChannel } from './room.utils.js';
import { setPlayerAvatarId } from './player-avatar.store.js';
import {
  validateCreateRoomPayload,
  validateJoinRoomPayload,
  validateUpdatePlayerAvatarPayload,
  validateUpdateRoomGameSettingsPayload,
} from './room.validators.js';

export function registerCreateRoomHandler(io: Server, socket: Socket): void {
  socket.on(
    CREATE_ROOM_EVENT,
    async (payload: unknown, callback?: (response: CreateRoomResponse) => void) => {
      if (!tryBeginRoomEntry(socket.id)) {
        sendResponse(callback, roomEntryBusyError());
        return;
      }

      try {
        console.info('[create-room]', { stage: 'socket-handler-received' });

        const validation = validateCreateRoomPayload(payload);

        if (!validation.success) {
          sendResponse(callback, validation);
          return;
        }

        if (!consumeCreateRoomLimit(socket)) {
          sendResponse(callback, rateLimitedRoomError());
          return;
        }

        // Fresh Create is a hard identity boundary: terminate any prior RoomPlayer
        // bound to this socket before creating a new host.
        if (socket.data.playerId && socket.data.roomId) {
          const priorPlayerId = socket.data.playerId as string;
          const priorRoomId = socket.data.roomId as string;
          const priorLeave = await roomMutationRuntime.leaveRoom(priorPlayerId, priorRoomId);
          await roomMutationRuntime.clearSocketSession(socket);

          if (priorLeave.success) {
            await roomMutationRuntime.announcePermanentPlayerRemoval(
              io,
              priorRoomId,
              priorPlayerId,
              priorLeave.data,
            );
          }
        } else if (socket.data.playerId || socket.data.roomId) {
          await roomMutationRuntime.clearSocketSession(socket);
        }

        const accountUser = await resolveSocketAccountUser(socket);
        const response = await roomMutationRuntime.createRoom(
          payload,
          accountUser?.id ?? null,
          accountUser?.role ?? null,
        );

        if (response.success) {
          const bindResult = await bindNewIdentityOrAbandon(
            socket,
            response.data.room.id,
            response.data.player.id,
            roomMutationRuntime.bindSocketToRoomSession,
            roomMutationRuntime.leaveRoom,
            roomMutationRuntime.clearSocketSession,
          );

          if (bindResult === 'abandoned') {
            console.info('[create-room]', {
              stage: 'socket-handler-complete',
              callbackErrorCode: 'CONNECTION_FAILED',
            });
            sendResponse(callback, connectionFailedRoomError());
            return;
          }

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
        opsLogger.error('room-create-handler-failed', 'تعذر إكمال طلب إنشاء الغرفة.', {
          operation: 'create-room-socket',
          stage: 'socket-handler-thrown',
          errorName: sanitizeErrorName(error),
          errorCode: sanitizeKnownErrorCode(error),
          callbackErrorCode: 'INTERNAL_ERROR',
        });
        sendInternalError(callback);
      } finally {
        endRoomEntry(socket.id);
      }
    },
  );
}

export function registerJoinRoomHandler(io: Server, socket: Socket): void {
  socket.on(
    JOIN_ROOM_EVENT,
    async (payload: unknown, callback?: (response: RoomActionResponse<unknown>) => void) => {
      if (!tryBeginRoomEntry(socket.id)) {
        sendResponse(callback, roomEntryBusyError());
        return;
      }

      try {
        const validation = validateJoinRoomPayload(payload);

        if (!validation.success) {
          sendResponse(callback, validation);
          return;
        }

        if (!consumeJoinRoomLimit(socket)) {
          sendResponse(callback, rateLimitedRoomError());
          return;
        }

        // Fresh Join is a hard identity boundary: terminate any prior RoomPlayer
        // bound to this socket before joining the requested room.
        if (socket.data.playerId && socket.data.roomId) {
          const priorPlayerId = socket.data.playerId as string;
          const priorRoomId = socket.data.roomId as string;
          const priorLeave = await roomMutationRuntime.leaveRoom(priorPlayerId, priorRoomId);
          await roomMutationRuntime.clearSocketSession(socket);

          if (priorLeave.success) {
            await roomMutationRuntime.announcePermanentPlayerRemoval(
              io,
              priorRoomId,
              priorPlayerId,
              priorLeave.data,
            );
          }
        } else if (socket.data.playerId || socket.data.roomId) {
          await roomMutationRuntime.clearSocketSession(socket);
        }

        const response = await roomMutationRuntime.joinRoom(
          payload,
          (await resolveSocketAccountUser(socket))?.id ?? null,
        );

        if (response.success) {
          const bindResult = await bindNewIdentityOrAbandon(
            socket,
            response.data.room.id,
            response.data.player.id,
            roomMutationRuntime.bindSocketToRoomSession,
            roomMutationRuntime.leaveRoom,
            roomMutationRuntime.clearSocketSession,
          );

          if (bindResult === 'abandoned') {
            console.info('[room-join]', {
              stage: 'failed',
              errorCode: 'CONNECTION_FAILED',
            });
            sendResponse(callback, connectionFailedRoomError());
            return;
          }

          console.info('[room-join]', {
            roomId: response.data.room.id,
            roomCode: response.data.room.code,
            playerId: response.data.player.id,
          });

          await roomMutationRuntime.broadcastRoomPlayersSnapshot(io, response.data.room.id);
          await roomMutationRuntime.onRoomRosterJoined(io, response.data.room.id);
        } else {
          console.info('[room-join]', {
            stage: 'failed',
            errorCode: response.error.code,
          });
        }

        sendResponse(callback, response);
      } catch {
        sendInternalError(callback);
      } finally {
        endRoomEntry(socket.id);
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
        const response = await roomMutationRuntime.leaveRoom(playerId!, roomId!);

        if (response.success) {
          console.info('[room-leave]', {
            roomId,
            playerId,
            roomDeleted: response.data.roomDeleted,
            hostChanged: Boolean(response.data.hostChanged),
          });

          await clearSocketSession(socket);
          await announcePermanentPlayerRemoval(io, roomId!, playerId!, response.data);
        }

        sendResponse(callback, response);
      } catch {
        sendInternalError(callback);
      }
    },
  );
}

export function registerEndRoomHandler(io: Server, socket: Socket): void {
  socket.on(
    END_ROOM_EVENT,
    async (_payload: unknown, callback?: (response: RoomActionResponse<unknown>) => void) => {
      const contextError = getSocketContext(socket);
      if (contextError) {
        sendResponse(callback, contextError);
        return;
      }

      const { playerId, roomId } = socket.data;
      try {
        const response = await endRoomByHost(roomId!, playerId!);
        if (response.success) {
          await announceRoomClosed(io, roomId!, 'أنهى المضيف الغرفة.');
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
          await announceKickedPlayer(
            io,
            roomId!,
            response.data.kickedPlayerId,
            response.data.roomDeleted,
          );
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

export function registerUpdateRoomGameSettingsHandler(io: Server, socket: Socket): void {
  socket.on(
    UPDATE_ROOM_GAME_SETTINGS_EVENT,
    async (payload: unknown, callback?: (response: RoomActionResponse<unknown>) => void) => {
      const contextError = getSocketContext(socket);
      if (contextError) {
        sendResponse(callback, contextError);
        return;
      }

      const validation = validateUpdateRoomGameSettingsPayload(payload);
      if (!validation.success) {
        sendResponse(callback, validation);
        return;
      }

      const { playerId, roomId } = socket.data;

      try {
        const accountUser = await resolveSocketAccountUser(socket);
        const response = await updateRoomGameSettings({
          roomId: roomId!,
          playerId: playerId!,
          isAdminSession: accountUser?.role === 'ADMIN',
          payload: {
            gameId: validation.data.gameId,
            settings: validation.data.settings as Record<string, number>,
          },
        });

        if (response.success) {
          io.to(getRoomChannel(roomId!)).emit(ROOM_GAME_SETTINGS_UPDATED_EVENT, response.data);
        }

        sendResponse(callback, response);
      } catch {
        sendInternalError(callback);
      }
    },
  );
}

export function registerUpdatePlayerAvatarHandler(io: Server, socket: Socket): void {
  socket.on(
    UPDATE_PLAYER_AVATAR_EVENT,
    async (payload: unknown, callback?: (response: RoomActionResponse<unknown>) => void) => {
      const contextError = getSocketContext(socket);
      if (contextError) {
        sendResponse(callback, contextError);
        return;
      }

      const validation = validateUpdatePlayerAvatarPayload(payload);
      if (!validation.success) {
        sendResponse(callback, validation);
        return;
      }

      const { playerId, roomId } = socket.data;
      const shell = getGameShellByRoomId(roomId!);
      if (shell && isActiveShellPhase(shell.phase)) {
        sendResponse(callback, {
          success: false,
          error: { code: 'MATCH_IN_PROGRESS', message: 'Avatar cannot be changed during a game.' },
        });
        return;
      }

      setPlayerAvatarId(playerId!, roomId!, validation.data.avatarId);
      await broadcastRoomPlayersSnapshot(io, roomId!);
      sendResponse(callback, { success: true, data: { avatarId: validation.data.avatarId } });
    },
  );
}

export function registerReconnectHandler(io: Server, socket: Socket): void {
  socket.on(
    RECONNECT_EVENT,
    async (payload: unknown, callback?: (response: RoomActionResponse<unknown>) => void) => {
      if (!tryBeginRoomEntry(socket.id)) {
        sendResponse(callback, roomEntryBusyError());
        return;
      }

      let postAckRoomId: string | undefined;

      try {
        if (!consumeReconnectLimit(socket)) {
          sendResponse(callback, rateLimitedRoomError());
          return;
        }

        const response = await roomMutationRuntime.reconnectPlayer(payload);

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

          if (!socket.connected) {
            await roomMutationRuntime.handlePlayerDisconnect(
              response.data.player.id,
              response.data.room.id,
            );
            sendResponse(callback, connectionFailedRoomError());
            return;
          }

          await roomMutationRuntime.bindSocketToRoomSession(
            socket,
            response.data.room.id,
            response.data.player.id,
          );

          if (!socket.connected) {
            await roomMutationRuntime.clearSocketSession(socket);
            await roomMutationRuntime.handlePlayerDisconnect(
              response.data.player.id,
              response.data.room.id,
            );
            sendResponse(callback, connectionFailedRoomError());
            return;
          }

          console.info('[room-reconnect]', {
            roomId: response.data.room.id,
            playerId: response.data.player.id,
            supersededSockets: existingSockets.filter((entry) => entry.id !== socket.id).length,
          });

          // Ack after bind so a later snapshot/recovery failure cannot surface as
          // INTERNAL_ERROR after the player was already reconnected successfully.
          sendResponse(callback, response);
          postAckRoomId = response.data.room.id;
        } else {
          if (response.error?.code === 'RECONNECT_EXPIRED') {
            const expiredMeta = response as ReconnectResponse & {
              expiredRoomId?: string;
              roomDeleted?: boolean;
            };
            const expiredPayload = payload as { playerId?: string; roomId?: string };
            const expiredRoomId =
              expiredMeta.expiredRoomId ?? expiredMeta.hostChanged?.roomId ?? expiredPayload.roomId;
            const expiredPlayerId = expiredPayload.playerId;

            if (expiredRoomId && expiredPlayerId) {
              await announcePermanentPlayerRemoval(io, expiredRoomId, expiredPlayerId, {
                roomDeleted: Boolean(expiredMeta.roomDeleted),
                hostChanged: response.hostChanged ?? null,
              });
            }
          } else if (response.hostChanged) {
            io.to(getRoomChannel(response.hostChanged.roomId)).emit(
              HOST_CHANGED_EVENT,
              response.hostChanged,
            );
          }

          sendResponse(callback, toPublicReconnectFailure(response));
        }
      } catch {
        sendInternalError(callback);
      } finally {
        endRoomEntry(socket.id);
      }

      if (!postAckRoomId) {
        return;
      }

      try {
        await roomMutationRuntime.broadcastRoomPlayersSnapshot(io, postAckRoomId);

        ensureGameShellLifecycleProgress(io, postAckRoomId);
        const shell = getGameShellByRoomId(postAckRoomId);

        if (shell) {
          socket.emit(GAME_SHELL_STATE_EVENT, { state: shell });
        }

        await evaluatePlayerRecovery(io, postAckRoomId);
      } catch (error) {
        opsLogger.warn('room-reconnect-side-effect-failed', 'تعذر إكمال مزامنة ما بعد العودة.', {
          operation: 'reconnect-post-ack',
          stage: 'post-ack-side-effect-failed',
          roomId: postAckRoomId,
          errorName: sanitizeErrorName(error),
          errorCode: sanitizeKnownErrorCode(error),
        });
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

      if (!consumeRoomSyncLimit(socket)) {
        sendResponse(callback, rateLimitedRoomError());
        return;
      }

      try {
        // Re-assert channel membership in case transport recovery dropped it.
        await roomMutationRuntime.bindSocketToRoomSession(socket, roomId!, playerId!);
        const response = await roomMutationRuntime.syncBoundRoomSession(playerId!, roomId!);

        if (response.success) {
          // CRITICAL: Reload roster immediately before ACK.
          // Concurrent joins can make the roster from syncBoundRoomSession stale by
          // the time we respond. Never ACK a roster older than the live room state.
          // Do NOT room-broadcast on sync — join/leave/disconnect already broadcast;
          // broadcasting here raced and could also stomp clients with ordering issues.
          if (process.env.WANASATNA_TEST_MODE === '1') {
            // Widen the race window so integration tests can land a join between the
            // early sync read and this final reload (production has no artificial delay).
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
          // Always re-read immediately before ACK (and once more after a tick) so a
          // concurrent join committed during syncBoundRoomSession is not missed.
          let freshPlayers = await roomMutationRuntime.loadActiveRoomPlayers(
            roomId!,
            response.data.room.hostPlayerId,
          );
          await new Promise<void>((resolve) => setImmediate(resolve));
          freshPlayers = await roomMutationRuntime.loadActiveRoomPlayers(
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
          socket.emit(ROOM_PLAYERS_SNAPSHOT_EVENT, {
            roomId: roomId!,
            players: freshPlayers,
          });
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
    forgetSocketAbuseState(socket.id);

    const { playerId, roomId } = socket.data;

    if (!playerId || !roomId) {
      return;
    }

    // Detach this socket immediately so concurrent reconnect bind wins cleanly.
    socket.data.playerId = undefined;
    socket.data.roomId = undefined;

    try {
      const presence = await applySocketDisconnectPresence(io, playerId, roomId, socket.id);

      if (presence !== 'disconnected') {
        console.info('[room-presence]', {
          stage:
            presence === 'restored'
              ? 'disconnect-restored-after-rebind'
              : 'disconnect-ignored-other-socket',
          roomId,
          playerId,
        });
        await broadcastRoomPlayersSnapshot(io, roomId);
        await evaluatePlayerRecovery(io, roomId);
        return;
      }

      console.info('[room-presence]', {
        stage: 'marked-disconnected',
        roomId,
        playerId,
      });

      let hostChanged = null;
      try {
        hostChanged = await transferHostIfCurrentHostDisconnected(roomId, playerId);
      } catch {
        // Presence snapshot must still run if host transfer hits a retryable race.
      }
      if (hostChanged) {
        io.to(getRoomChannel(roomId)).emit(HOST_CHANGED_EVENT, hostChanged);
      }

      await broadcastRoomPlayersSnapshot(io, roomId);
      await evaluatePlayerRecovery(io, roomId);
    } catch {
      // Disconnect cleanup should not crash the server.
    }
  });
}
