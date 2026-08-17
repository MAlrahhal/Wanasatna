import { Router } from 'express';
import type { AdminMeData, AuthActionResponse } from '@wanasatna/shared';
import { requireAdmin } from './require-admin.js';
import { toAdminPublicUser } from './to-admin-public-user.js';

export const adminRouter = Router();

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
