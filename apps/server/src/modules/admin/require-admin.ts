import type { NextFunction, Request, Response } from 'express';
import type { AuthActionResponse, AuthErrorCode, PublicUser } from '@wanasatna/shared';
import { readAuthCookie } from '../auth/auth.cookie.js';
import { resolveAuthSession } from '../auth/auth.service.js';

export const ADMIN_DENIED_MESSAGE = 'غير مصرح لك بالدخول إلى لوحة الإدارة.';

export type AdminAuthSuccess = {
  ok: true;
  user: PublicUser;
};

export type AdminAuthFailure = {
  ok: false;
  status: 401 | 403;
  code: Extract<AuthErrorCode, 'UNAUTHORIZED' | 'FORBIDDEN'>;
  message: string;
};

export type AdminAuthResult = AdminAuthSuccess | AdminAuthFailure;

export function authorizeAdmin(user: PublicUser | null | undefined): AdminAuthResult {
  if (!user) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      message: ADMIN_DENIED_MESSAGE,
    };
  }

  if (user.role !== 'ADMIN') {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: ADMIN_DENIED_MESSAGE,
    };
  }

  return { ok: true, user };
}

export async function resolveAdminUser(
  sessionToken: string | undefined,
): Promise<AdminAuthResult> {
  let user: PublicUser | null = null;

  try {
    user = await resolveAuthSession(sessionToken);
  } catch {
    user = null;
  }

  return authorizeAdmin(user);
}

function sendAdminDenied(res: Response, result: AdminAuthFailure): void {
  const body: AuthActionResponse<never> = {
    success: false,
    error: { code: result.code, message: result.message },
  };
  res.status(result.status).json(body);
}

/**
 * Server-authoritative Admin gate. Reads the current AuthSession cookie,
 * reloads User from the database, and checks User.role === ADMIN.
 * Ignores client role, email query params, and Player.userId.
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const result = await resolveAdminUser(readAuthCookie(req));

  if (!result.ok) {
    sendAdminDenied(res, result);
    return;
  }

  req.authUser = result.user;
  next();
}
