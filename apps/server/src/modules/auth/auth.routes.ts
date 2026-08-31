import { Router, type Response } from 'express';
import type {
  AuthActionResponse,
  AuthErrorCode,
  AuthLoginData,
  AuthMeData,
  AuthSessionData,
} from '@wanasatna/shared';
import { env } from '../../config/env.js';
import { getHttpClientIp } from '../../lib/client-ip.js';
import {
  checkLoginRateLimit,
  consumeAuthRateLimit,
  normalizeLoginIdentifier,
  recordLoginFailure,
  recordLoginSuccess,
} from './auth-rate-limit.js';
import {
  checkAdminMfaRateLimit,
  recordAdminMfaFailure,
  recordAdminMfaSuccess,
  shouldAuditAdminMfaRateLimit,
} from './admin-mfa-rate-limit.js';
import {
  auditAdminMfaRateLimit,
  resolveAdminMfaChallengeUserId,
  verifyAdminMfaChallenge,
} from './admin-mfa.service.js';
import { clearAuthCookie, readAuthCookie, setAuthCookie } from './auth.cookie.js';
import { loginUser, logoutAuthSession, registerUser } from './auth.service.js';
import { validateAdminMfaVerificationPayload } from './auth.validators.js';
import { createRequirePublicRegistration } from './public-registration.js';

export const authRouter = Router();

function sendAuthError(res: Response, status: number, code: AuthErrorCode, message: string): void {
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
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'EMAIL_TAKEN':
      return 409;
    case 'RATE_LIMITED':
      return 429;
    default:
      return 500;
  }
}

authRouter.post('/register', createRequirePublicRegistration(env.nodeEnv), async (req, res) => {
  if (!consumeAuthRateLimit(getHttpClientIp(req), 'register')) {
    sendAuthError(res, 429, 'RATE_LIMITED', 'طلبات كثيرة بسرعة، انتظر شوي وحاول مرة ثانية.');
    return;
  }

  try {
    const result = await registerUser(req.body);

    if (!result.success || !result.session) {
      if (!result.success) {
        sendAuthError(
          res,
          statusForAuthError(result.error.code),
          result.error.code,
          result.error.message,
        );
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
  const clientIp = getHttpClientIp(req);
  const identifier = normalizeLoginIdentifier(req.body);
  const rateLimit = checkLoginRateLimit(clientIp, identifier);

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    sendAuthError(res, 429, 'RATE_LIMITED', 'طلبات كثيرة بسرعة، انتظر شوي وحاول مرة ثانية.');
    return;
  }

  try {
    const result = await loginUser(req.body);

    if (!result.success) {
      if (result.error.code === 'INVALID_CREDENTIALS' || result.error.code === 'VALIDATION_ERROR') {
        recordLoginFailure(clientIp, identifier);
      }
      sendAuthError(
        res,
        statusForAuthError(result.error.code),
        result.error.code,
        result.error.message,
      );
      return;
    }

    recordLoginSuccess(clientIp, identifier);

    if (!('session' in result)) {
      clearAuthCookie(res);
      const body: AuthActionResponse<AuthLoginData> = {
        success: true,
        data: result.data,
      };
      res.status(202).json(body);
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

authRouter.post('/mfa/verify', async (req, res) => {
  const validation = validateAdminMfaVerificationPayload(req.body);
  if (!validation.success) {
    sendAuthError(res, 400, validation.error.code, validation.error.message);
    return;
  }

  const clientIp = getHttpClientIp(req);
  const { challengeToken } = validation.data;
  let challengeUserId: string | null;
  try {
    challengeUserId = await resolveAdminMfaChallengeUserId(challengeToken);
  } catch {
    sendAuthError(res, 500, 'INTERNAL_ERROR', 'تعذر التحقق من رمز الأمان.');
    return;
  }

  const rateLimit = checkAdminMfaRateLimit(clientIp, challengeToken, challengeUserId);
  if (!rateLimit.allowed) {
    if (challengeUserId && shouldAuditAdminMfaRateLimit(challengeUserId)) {
      const requestId = typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined;
      await auditAdminMfaRateLimit(challengeUserId, validation.data.method, requestId);
    }
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    sendAuthError(res, 429, 'RATE_LIMITED', 'طلبات كثيرة بسرعة، انتظر شوي وحاول مرة ثانية.');
    return;
  }

  try {
    const requestId = typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined;
    const result = await verifyAdminMfaChallenge(validation.data, new Date(), requestId);
    if (!result.success) {
      recordAdminMfaFailure(clientIp, challengeToken, challengeUserId);
      sendAuthError(
        res,
        statusForAuthError(result.error.code),
        result.error.code,
        result.error.message,
      );
      return;
    }

    recordAdminMfaSuccess(clientIp, challengeToken, challengeUserId);
    setAuthCookie(res, result.session.sessionToken, result.session.expiresAt);
    const body: AuthActionResponse<AuthSessionData> = {
      success: true,
      data: result.data,
    };
    res.status(200).json(body);
  } catch {
    sendAuthError(res, 500, 'INTERNAL_ERROR', 'تعذر التحقق من رمز الأمان.');
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
