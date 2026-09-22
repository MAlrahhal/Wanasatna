import { Router, type Response } from 'express';
import type {
  CreateFeedbackData,
  FeedbackActionResponse,
  FeedbackErrorCode,
} from '@wanasatna/shared';
import { getHttpClientIp } from '../../lib/client-ip.js';
import { opsLogger, sanitizeErrorName } from '../../lib/ops-logger.js';
import { consumeFeedbackRateLimit } from './feedback-rate-limit.js';
import {
  createFeedback,
  inferFeedbackDeviceCategory,
  normalizeFeedbackUserAgent,
} from './feedback.service.js';
import { createFeedbackSchema } from './feedback.validation.js';

export const feedbackRouter = Router();

const VALIDATION_MESSAGE = 'تأكد من اختيار النوع وكتابة ملاحظة بين 3 و2000 حرف.';
const RATE_LIMIT_MESSAGE = 'وصلتنا عدة ملاحظات بسرعة. انتظر قليلاً ثم حاول مرة أخرى.';
const INTERNAL_MESSAGE = 'تعذر إرسال الملاحظة الآن. حاول مرة أخرى.';

function sendError(res: Response, status: number, code: FeedbackErrorCode, message: string): void {
  res
    .status(status)
    .json({ success: false, error: { code, message } } satisfies FeedbackActionResponse<never>);
}

feedbackRouter.post('/', async (req, res) => {
  const parsed = createFeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'VALIDATION_ERROR', VALIDATION_MESSAGE);
    return;
  }

  if (!consumeFeedbackRateLimit(getHttpClientIp(req))) {
    res.setHeader('Retry-After', '300');
    sendError(res, 429, 'RATE_LIMITED', RATE_LIMIT_MESSAGE);
    return;
  }

  const userAgent = normalizeFeedbackUserAgent(req.headers['user-agent']);
  try {
    const data = await createFeedback(parsed.data, {
      userAgent,
      deviceCategory: inferFeedbackDeviceCategory(userAgent),
    });
    res
      .status(201)
      .json({ success: true, data } satisfies FeedbackActionResponse<CreateFeedbackData>);
  } catch (error) {
    opsLogger.error('feedback-create-failed', 'تعذر حفظ الملاحظة.', {
      requestId: typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined,
      errorName: sanitizeErrorName(error),
    });
    sendError(res, 500, 'INTERNAL_ERROR', INTERNAL_MESSAGE);
  }
});
