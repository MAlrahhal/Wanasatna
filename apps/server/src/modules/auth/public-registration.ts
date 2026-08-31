import type { RequestHandler } from 'express';

export function isPublicRegistrationEnabled(nodeEnv: string): boolean {
  return nodeEnv !== 'production';
}

export function createRequirePublicRegistration(nodeEnv: string): RequestHandler {
  return (_req, res, next): void => {
    if (isPublicRegistrationEnabled(nodeEnv)) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'التسجيل غير متاح.' },
    });
  };
}
