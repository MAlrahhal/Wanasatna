import { Router, type Response } from 'express';
import type {
  AuthActionResponse,
  AuthErrorCode,
  AuthSessionData,
  PurchaserOtpRequestData,
} from '@wanasatna/shared';
import { RATE_LIMITED_USER_MESSAGE } from '../../lib/abuse-limiter.js';
import { getHttpClientIp } from '../../lib/client-ip.js';
import { setAuthCookie } from './auth.cookie.js';
import {
  checkPurchaserOtpVerificationRateLimit,
  consumePurchaserOtpRequestLimit,
  recordPurchaserOtpVerificationFailure,
  recordPurchaserOtpVerificationSuccess,
} from './purchaser-otp-rate-limit.js';
import { getPurchaserOtpService } from './purchaser-otp.service.js';
import {
  validatePurchaserOtpRequestPayload,
  validatePurchaserOtpVerificationPayload,
} from './auth.validators.js';

export const purchaserOtpRouter = Router();

function sendError(res: Response, status: number, code: AuthErrorCode, message: string): void {
  const body: AuthActionResponse<never> = { success: false, error: { code, message } };
  res.status(status).json(body);
}

function statusForError(code: AuthErrorCode): number {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'OTP_INVALID':
      return 401;
    case 'RATE_LIMITED':
      return 429;
    case 'EMAIL_DELIVERY_UNAVAILABLE':
      return 503;
    default:
      return 500;
  }
}

purchaserOtpRouter.post('/request-code', async (req, res) => {
  const validation = validatePurchaserOtpRequestPayload(req.body);
  if (!validation.success) {
    sendError(res, 400, validation.error.code, validation.error.message);
    return;
  }

  const clientIp = getHttpClientIp(req);
  const limit = consumePurchaserOtpRequestLimit(clientIp, validation.data.email);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSeconds));
    sendError(res, 429, 'RATE_LIMITED', RATE_LIMITED_USER_MESSAGE);
    return;
  }

  try {
    const result = await getPurchaserOtpService().requestCode(validation.data.email);
    if (!result.success) {
      sendError(res, statusForError(result.error.code), result.error.code, result.error.message);
      return;
    }

    const body: AuthActionResponse<PurchaserOtpRequestData> = result;
    res.status(202).json(body);
  } catch {
    sendError(res, 500, 'INTERNAL_ERROR', 'تعذر معالجة طلب الرمز الآن.');
  }
});

purchaserOtpRouter.post('/verify-code', async (req, res) => {
  const validation = validatePurchaserOtpVerificationPayload(req.body);
  if (!validation.success) {
    sendError(res, 400, validation.error.code, validation.error.message);
    return;
  }

  const clientIp = getHttpClientIp(req);
  const limit = checkPurchaserOtpVerificationRateLimit(clientIp, validation.data.challengeId);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSeconds));
    sendError(res, 429, 'RATE_LIMITED', RATE_LIMITED_USER_MESSAGE);
    return;
  }

  try {
    const result = await getPurchaserOtpService().verifyCode(validation.data);
    if (!result.success) {
      if (result.error.code === 'OTP_INVALID') {
        recordPurchaserOtpVerificationFailure(clientIp, validation.data.challengeId);
      }
      sendError(res, statusForError(result.error.code), result.error.code, result.error.message);
      return;
    }

    recordPurchaserOtpVerificationSuccess(clientIp, validation.data.challengeId);
    setAuthCookie(res, result.session.sessionToken, result.session.expiresAt);
    const body: AuthActionResponse<AuthSessionData> = {
      success: true,
      data: result.data,
    };
    res.status(200).json(body);
  } catch {
    sendError(res, 500, 'INTERNAL_ERROR', 'تعذر التحقق من الرمز الآن.');
  }
});
