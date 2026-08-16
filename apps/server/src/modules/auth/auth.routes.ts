import { Router, type Response } from 'express';
import type { AuthActionResponse, AuthErrorCode, AuthMeData, AuthSessionData } from '@wanasatna/shared';
import { getHttpClientIp } from '../../lib/client-ip.js';
import { consumeAuthRateLimit } from './auth-rate-limit.js';
import { clearAuthCookie, readAuthCookie, setAuthCookie } from './auth.cookie.js';
import { loginUser, logoutAuthSession, registerUser } from './auth.service.js';

export const authRouter = Router();

function sendAuthError(
  res: Response,
  status: number,
  code: AuthErrorCode,
  message: string,
): void {
  const body: AuthActionResponse<never> = {
    success: false,
    error: { code, message },
  };
  res.status(status).json(body);
}

function statusForAuthError(code: AuthErrorCode): number {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'INVALID_CREDENTIALS':
      return 401;
    case 'EMAIL_TAKEN':
      return 409;
    case 'RATE_LIMITED':
      return 429;
    default:
      return 500;
  }
}

authRouter.post('/register', async (req, res) => {
  if (!consumeAuthRateLimit(getHttpClientIp(req), 'register')) {
    sendAuthError(res, 429, 'RATE_LIMITED', 'طلبات كثيرة بسرعة، انتظر شوي وحاول مرة ثانية.');
    return;
  }

  try {
    const result = await registerUser(req.body);

    if (!result.success || !result.session) {
      if (!result.success) {
        sendAuthError(res, statusForAuthError(result.error.code), result.error.code, result.error.message);
        return;
      }

      sendAuthError(res, 500, 'INTERNAL_ERROR', 'تعذّر إنشاء الحساب.');
      return;
    }

    setAuthCookie(res, result.session.sessionToken, result.session.expiresAt);
    const body: AuthActionResponse<AuthSessionData> = {
      success: true,
      data: { user: result.data.user },
    };
    res.status(201).json(body);
  } catch {
    sendAuthError(res, 500, 'INTERNAL_ERROR', 'تعذّر إنشاء الحساب.');
  }
});

authRouter.post('/login', async (req, res) => {
  if (!consumeAuthRateLimit(getHttpClientIp(req), 'login')) {
    sendAuthError(res, 429, 'RATE_LIMITED', 'طلبات كثيرة بسرعة، انتظر شوي وحاول مرة ثانية.');
    return;
  }

  try {
    const result = await loginUser(req.body);

    if (!result.success || !result.session) {
      if (!result.success) {
        sendAuthError(res, statusForAuthError(result.error.code), result.error.code, result.error.message);
        return;
      }

      sendAuthError(res, 500, 'INTERNAL_ERROR', 'تعذّر تسجيل الدخول.');
      return;
    }

    setAuthCookie(res, result.session.sessionToken, result.session.expiresAt);
    const body: AuthActionResponse<AuthSessionData> = {
      success: true,
      data: { user: result.data.user },
    };
    res.status(200).json(body);
  } catch {
    sendAuthError(res, 500, 'INTERNAL_ERROR', 'تعذّر تسجيل الدخول.');
  }
});

authRouter.post('/logout', async (req, res) => {
  try {
    await logoutAuthSession(readAuthCookie(req));
  } catch {
    // Logout is idempotent even if the row is already gone.
  }

  clearAuthCookie(res);
  const body: AuthActionResponse<{ ok: true }> = { success: true, data: { ok: true } };
  res.status(200).json(body);
});

authRouter.get('/me', (req, res) => {
  const body: AuthActionResponse<AuthMeData> = {
    success: true,
    data: { user: req.authUser ?? null },
  };
  res.status(200).json(body);
});
