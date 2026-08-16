import type { NextFunction, Request, Response } from 'express';
import { resolveAuthSession } from './auth.service.js';
import { readAuthCookie } from './auth.cookie.js';

export async function attachOptionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    req.authUser = await resolveAuthSession(readAuthCookie(req));
  } catch {
    req.authUser = null;
  }

  next();
}
