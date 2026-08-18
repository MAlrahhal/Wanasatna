import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type {
  AdminActionResponse,
  AdminDashboardData,
  AdminErrorCode,
  AdminGamesData,
  AdminHistoryData,
  AdminMatchDetails,
  AdminMeData,
  AdminUserDetails,
  AdminUsersData,
  AuthActionResponse,
} from '@wanasatna/shared';
import { isPlayableGameId } from '@wanasatna/shared';
import { getAdminDashboard } from './dashboard.service.js';
import {
  ADMIN_ROOM_ACTION_FAILED,
  adminForceCloseRoom,
  adminKickPlayer,
  adminLockRoom,
  getAdminRoomById,
  listAdminRooms,
} from './admin-rooms.service.js';
import { getAdminMatchById, listAdminHistory } from './admin-history.service.js';
import { getAdminUserById, listAdminUsers } from './admin-users.service.js';
import { requireAdmin } from './require-admin.js';
import { toAdminPublicUser } from './to-admin-public-user.js';
import {
  listGameAvailability,
  setGameEnabled,
} from '../game/game-availability.service.js';

export const adminRouter = Router();

const ADMIN_LOAD_FAILED = 'تعذر تحميل لوحة الإدارة.';

function sendAdminJsonError(
  res: { status: (code: number) => { json: (body: unknown) => void } },
  status: number,
  code: AdminErrorCode,
  message: string,
): void {
  const body: AdminActionResponse<never> = {
    success: false,
    error: { code, message },
  };
  res.status(status).json(body);
}

function isPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

adminRouter.get('/me', requireAdmin, (req, res) => {
  const user = req.authUser;

  if (!user || user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'غير مصرح لك بالدخول إلى لوحة الإدارة.',
      },
    } satisfies AuthActionResponse<never>);
    return;
  }

  const body: AuthActionResponse<AdminMeData> = {
    success: true,
    data: { user: toAdminPublicUser(user) },
  };
  res.status(200).json(body);
});

adminRouter.get('/dashboard', requireAdmin, async (_req, res) => {
  try {
    const data = await getAdminDashboard();
    const body: AuthActionResponse<AdminDashboardData> = {
      success: true,
      data,
    };
    res.status(200).json(body);
  } catch {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: ADMIN_LOAD_FAILED,
      },
    } satisfies AuthActionResponse<never>);
  }
});

adminRouter.get('/rooms', requireAdmin, async (_req, res) => {
  try {
    const data = await listAdminRooms();
    res.status(200).json({ success: true, data } satisfies AdminActionResponse<typeof data>);
  } catch (error) {
    if (isPrismaError(error)) {
      sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_LOAD_FAILED);
      return;
    }
    sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_LOAD_FAILED);
  }
});

adminRouter.get('/rooms/:roomId', requireAdmin, async (req, res) => {
  try {
    const result = await getAdminRoomById(req.params.roomId);
    if (!result.success) {
      sendAdminJsonError(res, 404, result.error.code, result.error.message);
      return;
    }
    res.status(200).json(result);
  } catch (error) {
    if (isPrismaError(error)) {
      sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_LOAD_FAILED);
      return;
    }
    sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_LOAD_FAILED);
  }
});

adminRouter.post('/rooms/:roomId/lock', requireAdmin, async (req, res) => {
  const adminUserId = req.authUser?.id;
  if (!adminUserId) {
    sendAdminJsonError(res, 403, 'FORBIDDEN', 'غير مصرح لك بالدخول إلى لوحة الإدارة.');
    return;
  }

  try {
    const result = await adminLockRoom(req.params.roomId, adminUserId, true);
    if (!result.success) {
      sendAdminJsonError(
        res,
        result.error.code === 'ROOM_NOT_FOUND' ? 404 : 400,
        result.error.code,
        result.error.message,
      );
      return;
    }
    res.status(200).json(result);
  } catch (error) {
    if (isPrismaError(error)) {
      sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_ROOM_ACTION_FAILED);
      return;
    }
    sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_ROOM_ACTION_FAILED);
  }
});

adminRouter.post('/rooms/:roomId/unlock', requireAdmin, async (req, res) => {
  const adminUserId = req.authUser?.id;
  if (!adminUserId) {
    sendAdminJsonError(res, 403, 'FORBIDDEN', 'غير مصرح لك بالدخول إلى لوحة الإدارة.');
    return;
  }

  try {
    const result = await adminLockRoom(req.params.roomId, adminUserId, false);
    if (!result.success) {
      sendAdminJsonError(
        res,
        result.error.code === 'ROOM_NOT_FOUND' ? 404 : 400,
        result.error.code,
        result.error.message,
      );
      return;
    }
    res.status(200).json(result);
  } catch (error) {
    if (isPrismaError(error)) {
      sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_ROOM_ACTION_FAILED);
      return;
    }
    sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_ROOM_ACTION_FAILED);
  }
});

adminRouter.post('/rooms/:roomId/players/:playerId/kick', requireAdmin, async (req, res) => {
  const adminUserId = req.authUser?.id;
  if (!adminUserId) {
    sendAdminJsonError(res, 403, 'FORBIDDEN', 'غير مصرح لك بالدخول إلى لوحة الإدارة.');
    return;
  }

  try {
    const result = await adminKickPlayer(req.params.roomId, req.params.playerId, adminUserId);
    if (!result.success) {
      const status =
        result.error.code === 'ROOM_NOT_FOUND' || result.error.code === 'PLAYER_NOT_FOUND'
          ? 404
          : 400;
      sendAdminJsonError(res, status, result.error.code, result.error.message);
      return;
    }
    res.status(200).json(result);
  } catch (error) {
    if (isPrismaError(error)) {
      sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_ROOM_ACTION_FAILED);
      return;
    }
    sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_ROOM_ACTION_FAILED);
  }
});

adminRouter.delete('/rooms/:roomId', requireAdmin, async (req, res) => {
  const adminUserId = req.authUser?.id;
  if (!adminUserId) {
    sendAdminJsonError(res, 403, 'FORBIDDEN', 'غير مصرح لك بالدخول إلى لوحة الإدارة.');
    return;
  }

  try {
    const result = await adminForceCloseRoom(req.params.roomId, adminUserId);
    if (!result.success) {
      sendAdminJsonError(res, 500, result.error.code, result.error.message);
      return;
    }
    res.status(200).json(result);
  } catch (error) {
    if (isPrismaError(error)) {
      if (error.code === 'P2025') {
        res.status(200).json({
          success: true,
          data: { roomId: req.params.roomId, alreadyClosed: true },
        });
        return;
      }
      sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_ROOM_ACTION_FAILED);
      return;
    }
    sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_ROOM_ACTION_FAILED);
  }
});

const patchGameAvailabilitySchema = z.object({
  isEnabled: z.boolean(),
});

adminRouter.get('/games', requireAdmin, async (_req, res) => {
  try {
    const data = await listGameAvailability();
    res.status(200).json({ success: true, data } satisfies AdminActionResponse<AdminGamesData>);
  } catch (error) {
    if (isPrismaError(error)) {
      sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_LOAD_FAILED);
      return;
    }
    sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_LOAD_FAILED);
  }
});

adminRouter.patch('/games/:gameId', requireAdmin, async (req, res) => {
  const gameId = typeof req.params.gameId === 'string' ? req.params.gameId.trim() : '';
  if (!isPlayableGameId(gameId)) {
    sendAdminJsonError(res, 400, 'VALIDATION_ERROR', 'هذه اللعبة غير معروفة.');
    return;
  }

  const parsed = patchGameAvailabilitySchema.safeParse(req.body);
  if (!parsed.success) {
    sendAdminJsonError(res, 400, 'VALIDATION_ERROR', 'قيمة التفعيل غير صالحة.');
    return;
  }

  try {
    const data = await setGameEnabled(gameId, parsed.data.isEnabled);
    res.status(200).json({ success: true, data } satisfies AdminActionResponse<typeof data>);
  } catch (error) {
    if (isPrismaError(error)) {
      sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_LOAD_FAILED);
      return;
    }
    sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_LOAD_FAILED);
  }
});

adminRouter.get('/users', requireAdmin, async (req, res) => {
  try {
    const data = await listAdminUsers({
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      page: req.query.page,
    });
    res.status(200).json({ success: true, data } satisfies AdminActionResponse<AdminUsersData>);
  } catch (error) {
    if (isPrismaError(error)) {
      sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_LOAD_FAILED);
      return;
    }
    sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_LOAD_FAILED);
  }
});

adminRouter.get('/users/:userId', requireAdmin, async (req, res) => {
  const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : '';
  if (!userId || userId.length > 64) {
    sendAdminJsonError(res, 400, 'VALIDATION_ERROR', 'معرّف المستخدم غير صالح.');
    return;
  }

  try {
    const result = await getAdminUserById(userId);
    if (!result.success) {
      sendAdminJsonError(res, 404, result.error.code, result.error.message);
      return;
    }
    res.status(200).json(result satisfies AdminActionResponse<AdminUserDetails>);
  } catch (error) {
    if (isPrismaError(error)) {
      sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_LOAD_FAILED);
      return;
    }
    sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_LOAD_FAILED);
  }
});

adminRouter.get('/history', requireAdmin, async (req, res) => {
  try {
    const data = await listAdminHistory({
      gameId: req.query.gameId,
      status: req.query.status,
      page: req.query.page,
    });
    res.status(200).json({ success: true, data } satisfies AdminActionResponse<AdminHistoryData>);
  } catch (error) {
    if (isPrismaError(error)) {
      sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_LOAD_FAILED);
      return;
    }
    sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_LOAD_FAILED);
  }
});

adminRouter.get('/history/:matchId', requireAdmin, async (req, res) => {
  const matchId = typeof req.params.matchId === 'string' ? req.params.matchId.trim() : '';
  if (!matchId || matchId.length > 64) {
    sendAdminJsonError(res, 400, 'VALIDATION_ERROR', 'معرّف المباراة غير صالح.');
    return;
  }

  try {
    const result = await getAdminMatchById(matchId);
    if (!result.success) {
      sendAdminJsonError(res, 404, result.error.code, result.error.message);
      return;
    }
    res.status(200).json(result satisfies AdminActionResponse<AdminMatchDetails>);
  } catch (error) {
    if (isPrismaError(error)) {
      sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_LOAD_FAILED);
      return;
    }
    sendAdminJsonError(res, 500, 'INTERNAL_ERROR', ADMIN_LOAD_FAILED);
  }
});
