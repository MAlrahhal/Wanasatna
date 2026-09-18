import { opsLogger, sanitizeErrorName } from '../../../lib/ops-logger.js';
import { purgeExpiredAnswerAttempts } from './answer-attempt-log.js';
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

/** Legacy test teardown hook; scheduling is centralized in database-maintenance.ts. */
export function stopExpiredAnswerAttemptCleanup(): void {
  sweepInFlight = false;
}
