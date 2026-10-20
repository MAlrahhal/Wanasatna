import type { Server, Socket } from 'socket.io';
import {
  EXPERIMENTAL_GAME_SELECTED_EVENT,
  SELECT_EXPERIMENTAL_GAME_EVENT,
  type SelectExperimentalGameResponse,
} from '@wanasatna/shared';
import { resolveSocketAccountUser } from '../../auth/socket-auth.js';
import { broadcastRoomPlayersSnapshot, getRoomChannel } from '../../room/room.utils.js';
import { validateSelectExperimentalGamePayload } from '../game.validators.js';
import {
  getGameSocketContext,
  sendGameInternalError,
  sendGameResponse,
} from '../game.socket.utils.js';
import { selectExperimentalGameForRoom } from './experimental-game-access.service.js';
import { getGameShellByRoomId } from '../game.service.js';

export function registerExperimentalGameSelectionHandler(io: Server, socket: Socket): void {
  socket.on(SELECT_EXPERIMENTAL_GAME_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const validation = validateSelectExperimentalGamePayload(payload);
    if (!validation.success) {
      sendGameResponse(callback, validation);
      return;
    }

    try {
      const accountUser = await resolveSocketAccountUser(socket);
      const response: SelectExperimentalGameResponse = await selectExperimentalGameForRoom({
        roomId: socket.data.roomId!,
        playerId: socket.data.playerId!,
        gameId: validation.data.gameId,
        authority: {
          accountUserId: accountUser?.id ?? null,
          accountRole: accountUser?.role ?? null,
        },
        isMatchActive: () => getGameShellByRoomId(socket.data.roomId!) !== null,
      });

      if (response.success) {
        io.to(getRoomChannel(response.data.roomId)).emit(
          EXPERIMENTAL_GAME_SELECTED_EVENT,
          response.data,
        );
        await broadcastRoomPlayersSnapshot(io, response.data.roomId);
      }
      sendGameResponse(callback, response);
    } catch {
      sendGameInternalError(callback);
    }
  });
}
