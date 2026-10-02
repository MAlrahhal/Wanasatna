import { prisma } from '../../lib/prisma.js';

let cleanupInFlight = false;

export async function purgeExpiredPurchaserOtpChallenges(now = new Date()): Promise<number> {
  const deleted = await prisma.purchaserEmailOtpChallenge.deleteMany({
    where: { expiresAt: { lte: now } },
  });
  return deleted.count;
}

export async function runExpiredPurchaserOtpCleanup(now = new Date()): Promise<void> {
  if (cleanupInFlight) {
    return;
  }

  cleanupInFlight = true;
  try {
    const purged = await purgeExpiredPurchaserOtpChallenges(now);
    if (purged > 0) {
      console.info('[purchaser-otp]', { stage: 'expired-purged', purged });
    }
  } catch (error) {
    console.error('[purchaser-otp]', {
      stage: 'expired-purge-failed',
      errorName: error instanceof Error ? error.name : typeof error,
    });
  } finally {
    cleanupInFlight = false;
  }
}

export function resetPurchaserOtpCleanupForTests(): void {
  cleanupInFlight = false;
}
