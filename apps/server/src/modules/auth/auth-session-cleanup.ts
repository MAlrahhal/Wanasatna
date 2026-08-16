import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';

function cleanupIntervalMs(): number {
  return env.testMode ? 200 : 15 * 60 * 1000;
}

export const AUTH_SESSION_CLEANUP_INTERVAL_MS = cleanupIntervalMs();

let sweepIntervalId: ReturnType<typeof setInterval> | null = null;
let sweepInFlight = false;

export async function purgeExpiredAuthSessions(now: Date = new Date()): Promise<number> {
  const deleted = await prisma.authSession.deleteMany({
    where: {
      expiresAt: { lte: now },
    },
  });

  return deleted.count;
}

export async function runExpiredAuthSessionCleanup(): Promise<void> {
  if (sweepInFlight) {
    return;
  }

  sweepInFlight = true;

  try {
    const expiredAuthSessionsPurged = await purgeExpiredAuthSessions();
    if (expiredAuthSessionsPurged > 0) {
      console.info('[auth-session]', {
        stage: 'expired-purged',
        expiredAuthSessionsPurged,
      });
    }
  } catch (error) {
    console.error('[auth-session]', {
      stage: 'expired-purge-failed',
      errorName: error instanceof Error ? error.name : typeof error,
    });
  } finally {
    sweepInFlight = false;
  }
}

export function startExpiredAuthSessionCleanup(): void {
  if (sweepIntervalId) {
    return;
  }

  const intervalMs = cleanupIntervalMs();
  sweepIntervalId = setInterval(() => {
    void runExpiredAuthSessionCleanup();
  }, intervalMs);

  if (!env.testMode) {
    sweepIntervalId.unref();
  }
}

export function stopExpiredAuthSessionCleanup(): void {
  if (!sweepIntervalId) {
    return;
  }

  clearInterval(sweepIntervalId);
  sweepIntervalId = null;
  sweepInFlight = false;
}
