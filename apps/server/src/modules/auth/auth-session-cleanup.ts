import { prisma } from '../../lib/prisma.js';
let sweepInFlight = false;

export async function purgeExpiredAuthSessions(now: Date = new Date()): Promise<number> {
  const deleted = await prisma.authSession.deleteMany({
    where: {
      expiresAt: { lte: now },
    },
  });

  return deleted.count;
}

export async function runExpiredAuthSessionCleanup(now: Date = new Date()): Promise<void> {
  if (sweepInFlight) {
    return;
  }

  sweepInFlight = true;

  try {
    const expiredAuthSessionsPurged = await purgeExpiredAuthSessions(now);
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

/** Legacy test teardown hook; scheduling is centralized in database-maintenance.ts. */
export function stopExpiredAuthSessionCleanup(): void {
  sweepInFlight = false;
}
