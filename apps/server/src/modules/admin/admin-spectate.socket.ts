import type { Server, Socket } from 'socket.io';
import type { AdminActionResponse, AdminSpectateData } from '@wanasatna/shared';
import {
  ADMIN_SPECTATE_ALLOWED_EVENTS,
  ADMIN_SPECTATE_JOIN_EVENT,
  ADMIN_SPECTATE_LEAVE_EVENT,
  ADMIN_SPECTATE_SYNC_EVENT,
} from '@wanasatna/shared';
import { consumeGameSyncLimit } from '../../lib/abuse-limiter.js';
import { resolveSocketAccountUser } from '../auth/socket-auth.js';
import { getRoomChannel } from '../room/room.utils.js';
import '../room/room.types.js';
import { createAdminAuditLogBestEffort } from './admin-audit.service.js';
import { ADMIN_DENIED_MESSAGE, authorizeAdmin } from './require-admin.js';
import {
  ADMIN_SPECTATE_DENIED_MESSAGE,
  ADMIN_SPECTATE_FAILED_MESSAGE,
  ADMIN_SPECTATE_PLAYER_SESSION_MESSAGE,
  loadAdminSpectateSnapshot,
} from './admin-spectate.service.js';

const ALLOWED_EVENTS = new Set<string>(ADMIN_SPECTATE_ALLOWED_EVENTS);

function sendSpectateResponse<T>(
  callback: ((response: AdminActionResponse<T>) => void) | undefined,
  response: AdminActionResponse<T>,
): void {
  if (typeof callback === 'function') {
    callback(response);
  }
}

function parseRoomId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const roomId = (payload as { roomId?: unknown }).roomId;
  if (typeof roomId !== 'string' || roomId.length < 8 || roomId.length > 64) {
    return null;
  }

  return roomId;
}

async function clearAdminSpectateBinding(socket: Socket): Promise<void> {
  const roomId = socket.data.adminSpectateRoomId;
  if (roomId) {
    await socket.leave(getRoomChannel(roomId));
  }

  socket.data.adminSpectate = false;
  socket.data.adminSpectateRoomId = undefined;
}

async function authorizeSpectateSocket(socket: Socket): Promise<AdminActionResponse<never> | null> {
  const user = await resolveSocketAccountUser(socket);
  const auth = authorizeAdmin(user);
  if (auth.ok) {
    return null;
  }

  return {
    success: false,
    error: {
      code: auth.code,
      message: auth.code === 'UNAUTHORIZED' ? ADMIN_DENIED_MESSAGE : ADMIN_SPECTATE_DENIED_MESSAGE,
    },
  };
}

function attachAdminSpectateEmitGuard(socket: Socket): void {
  socket.use((packet, next) => {
    if (!socket.data.adminSpectate) {
      next();
      return;
    }

    const event = packet[0];
    if (typeof event === 'string' && ALLOWED_EVENTS.has(event)) {
      next();
      return;
    }

    const ack = packet[packet.length - 1];
    if (typeof ack === 'function') {
      ack({
        success: false,
        error: { code: 'FORBIDDEN', message: ADMIN_SPECTATE_DENIED_MESSAGE },
      } satisfies AdminActionResponse<never>);
    }
  });
}

export function registerAdminSpectateSockets(io: Server): void {
  io.on('connection', (socket) => {
    attachAdminSpectateEmitGuard(socket);

    socket.on(ADMIN_SPECTATE_JOIN_EVENT, async (payload: unknown, callback) => {
      const authError = await authorizeSpectateSocket(socket);
      if (authError) {
        sendSpectateResponse(callback, authError);
        return;
      }

      if (socket.data.playerId) {
        sendSpectateResponse(callback, {
          success: false,
          error: { code: 'FORBIDDEN', message: ADMIN_SPECTATE_PLAYER_SESSION_MESSAGE },
        });
        return;
      }

      const roomId = parseRoomId(payload);
      if (!roomId) {
        sendSpectateResponse(callback, {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: ADMIN_SPECTATE_FAILED_MESSAGE },
        });
        return;
      }

      const snapshot = await loadAdminSpectateSnapshot(roomId);
      const adminUserId = socket.data.authUser?.id ?? null;

      if (!snapshot.success) {
        await createAdminAuditLogBestEffort({
          actorUserId: adminUserId,
          action: 'ROOM_SPECTATE',
          targetId: roomId,
          outcome: 'FAILURE',
        });
        sendSpectateResponse(callback, snapshot);
        return;
      }

      await clearAdminSpectateBinding(socket);
      socket.data.adminSpectate = true;
      socket.data.adminSpectateRoomId = roomId;
      socket.data.playerId = undefined;
      socket.data.roomId = undefined;
      await socket.join(getRoomChannel(roomId));

      await createAdminAuditLogBestEffort({
        actorUserId: adminUserId,
        action: 'ROOM_SPECTATE',
        targetId: roomId,
        outcome: 'SUCCESS',
      });

      sendSpectateResponse<AdminSpectateData>(callback, snapshot);
    });

    socket.on(ADMIN_SPECTATE_SYNC_EVENT, async (_payload: unknown, callback) => {
      const authError = await authorizeSpectateSocket(socket);
      if (authError) {
        sendSpectateResponse(callback, authError);
        return;
      }

      if (!socket.data.adminSpectate || !socket.data.adminSpectateRoomId) {
        sendSpectateResponse(callback, {
          success: false,
          error: { code: 'FORBIDDEN', message: ADMIN_SPECTATE_DENIED_MESSAGE },
        });
        return;
      }

      if (!consumeGameSyncLimit(socket)) {
        sendSpectateResponse(callback, {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: ADMIN_SPECTATE_FAILED_MESSAGE },
        });
        return;
      }

      const snapshot = await loadAdminSpectateSnapshot(socket.data.adminSpectateRoomId);
      if (
        !snapshot.success &&
        (snapshot.error.code === 'ROOM_CLOSED' || snapshot.error.code === 'ROOM_NOT_FOUND')
      ) {
        await clearAdminSpectateBinding(socket);
      }

      sendSpectateResponse(callback, snapshot);
    });

    socket.on(ADMIN_SPECTATE_LEAVE_EVENT, async (_payload: unknown, callback) => {
      await clearAdminSpectateBinding(socket);
      sendSpectateResponse(callback, { success: true, data: { left: true } });
    });

    socket.on('disconnect', () => {
      void clearAdminSpectateBinding(socket);
    });
  });
}
