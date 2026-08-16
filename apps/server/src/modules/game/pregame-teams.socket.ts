import type { Server, Socket } from 'socket.io';
import {
  TEAM_ASSIGN_EVENT,
  TEAM_CONFIGURE_EVENT,
  TEAM_RANDOMIZE_EVENT,
  TEAM_SNAPSHOT_EVENT,
  TEAM_SYNC_EVENT,
  type PregameTeamSnapshot,
  type TeamAssignPayload,
  type TeamConfigurePayload,
  type TeamId,
} from '@wanasatna/shared';
import { getRoomChannel } from '../room/room.utils.js';
import {
  getGameSocketContext,
  rejectIfGameSyncRateLimited,
  sendGameInternalError,
  sendGameResponse,
} from './game.socket.utils.js';
import {
  assertHost,
  assignPlayerToTeam,
  clearTeamsIfGameChanged,
  configurePregameTeams,
  getPregameTeamSnapshot,
  loadEligibleLobbyPlayerIds,
  randomizePregameTeams,
} from './runtime/pregame-teams.service.js';

function broadcastTeamSnapshot(io: Server, roomId: string, snapshot: PregameTeamSnapshot): void {
  io.to(getRoomChannel(roomId)).emit(TEAM_SNAPSHOT_EVENT, snapshot);
}

function isTeamId(value: unknown): value is TeamId {
  return value === 'blue' || value === 'red';
}

export function registerPregameTeamHandlers(io: Server, socket: Socket): void {
  socket.on(TEAM_SYNC_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    if (rejectIfGameSyncRateLimited(socket, callback)) {
      return;
    }

    const { roomId } = socket.data;

    try {
      const eligible = await loadEligibleLobbyPlayerIds(roomId!);
      const snapshot = getPregameTeamSnapshot(roomId!, eligible);
      sendGameResponse(callback, { success: true, data: { snapshot } });
      if (snapshot) {
        socket.emit(TEAM_SNAPSHOT_EVENT, snapshot);
      }
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(TEAM_CONFIGURE_EVENT, async (payload: TeamConfigurePayload, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId, playerId } = socket.data;

    try {
      if (!payload || typeof payload.gameId !== 'string' || typeof payload.mode !== 'string') {
        sendGameResponse(callback, {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'بيانات توزيع الفرق غير صالحة.' },
        });
        return;
      }

      if (!(await assertHost(roomId!, playerId!))) {
        sendGameResponse(callback, {
          success: false,
          error: { code: 'NOT_HOST', message: 'فقط المضيف يمكنه توزيع الفرق.' },
        });
        return;
      }

      clearTeamsIfGameChanged(roomId!, payload.gameId);
      const eligible = await loadEligibleLobbyPlayerIds(roomId!);
      const result = configurePregameTeams({
        roomId: roomId!,
        gameId: payload.gameId,
        mode: payload.mode,
        eligiblePlayerIds: eligible,
        preserveManual: true,
      });

      if (!result.success) {
        sendGameResponse(callback, result);
        return;
      }

      broadcastTeamSnapshot(io, roomId!, result.data);
      sendGameResponse(callback, result);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(TEAM_ASSIGN_EVENT, async (payload: TeamAssignPayload, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId, playerId } = socket.data;

    try {
      if (
        !payload ||
        typeof payload.playerId !== 'string' ||
        !isTeamId(payload.teamId)
      ) {
        sendGameResponse(callback, {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'تعيين الفريق غير صالح.' },
        });
        return;
      }

      if (!(await assertHost(roomId!, playerId!))) {
        sendGameResponse(callback, {
          success: false,
          error: { code: 'NOT_HOST', message: 'فقط المضيف يمكنه توزيع الفرق.' },
        });
        return;
      }

      const eligible = await loadEligibleLobbyPlayerIds(roomId!);
      const result = assignPlayerToTeam({
        roomId: roomId!,
        playerId: payload.playerId,
        teamId: payload.teamId,
        eligiblePlayerIds: eligible,
      });

      if (!result.success) {
        sendGameResponse(callback, result);
        return;
      }

      broadcastTeamSnapshot(io, roomId!, result.data);
      sendGameResponse(callback, result);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(TEAM_RANDOMIZE_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId, playerId } = socket.data;

    try {
      if (!(await assertHost(roomId!, playerId!))) {
        sendGameResponse(callback, {
          success: false,
          error: { code: 'NOT_HOST', message: 'فقط المضيف يمكنه توزيع الفرق.' },
        });
        return;
      }

      const eligible = await loadEligibleLobbyPlayerIds(roomId!);
      const result = randomizePregameTeams({
        roomId: roomId!,
        eligiblePlayerIds: eligible,
      });

      if (!result.success) {
        sendGameResponse(callback, result);
        return;
      }

      broadcastTeamSnapshot(io, roomId!, result.data);
      sendGameResponse(callback, result);
    } catch {
      sendGameInternalError(callback);
    }
  });
}

export { broadcastTeamSnapshot };
