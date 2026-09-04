import { env } from '../../../config/env.js';
import { opsLogger, sanitizeErrorName } from '../../../lib/ops-logger.js';
import { purgeExpiredAnswerAttempts } from './answer-attempt-log.js';

function cleanupIntervalMs(): number {
  return env.testMode ? 200 : 15 * 60 * 1000;
}

export const ANSWER_ATTEMPT_CLEANUP_INTERVAL_MS = cleanupIntervalMs();

let sweepIntervalId: ReturnType<typeof setInterval> | null = null;
let sweepInFlight = false;

export async function runExpiredAnswerAttemptCleanup(now: Date = new Date()): Promise<void> {
  if (sweepInFlight) {
    return;
  }

  sweepInFlight = true;

  try {
    const expiredAnswerAttemptsPurged = await purgeExpiredAnswerAttempts(now);
    if (expiredAnswerAttemptsPurged > 0) {
      opsLogger.info('answer-attempt-cleanup', 'تم حذف سجلات الإجابات المنتهية.', {
        expiredAnswerAttemptsPurged,
      });
    }
  } catch (error) {
    opsLogger.error('answer-attempt-cleanup-failed', 'تعذر تنظيف سجلات الإجابات المنتهية.', {
      errorName: sanitizeErrorName(error),
    });
  } finally {
    sweepInFlight = false;
  }
}

export function startExpiredAnswerAttemptCleanup(): void {
  if (sweepIntervalId) {
    return;
  }

  const intervalMs = cleanupIntervalMs();
  sweepIntervalId = setInterval(() => {
    void runExpiredAnswerAttemptCleanup();
  }, intervalMs);

  sweepIntervalId.unref();
}

export function stopExpiredAnswerAttemptCleanup(): void {
  if (!sweepIntervalId) {
    return;
  }

  clearInterval(sweepIntervalId);
  sweepIntervalId = null;
  sweepInFlight = false;
}
