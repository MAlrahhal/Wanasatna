import { runExpiredAuthSessionCleanup } from '../modules/auth/auth-session-cleanup.js';
import { runExpiredAnswerAttemptCleanup } from '../modules/game/runtime/answer-attempt-cleanup.js';

export const DATABASE_MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000;

type MaintenanceTimerHandle = ReturnType<typeof setInterval>;
type MaintenanceTimerClock = {
  setInterval: (callback: () => void, intervalMs: number) => MaintenanceTimerHandle;
  clearInterval: (handle: MaintenanceTimerHandle) => void;
};

const defaultTimerClock: MaintenanceTimerClock = {
  setInterval: (callback, intervalMs) => setInterval(callback, intervalMs),
  clearInterval: (handle) => clearInterval(handle),
};

let maintenanceTimer: MaintenanceTimerHandle | null = null;
let maintenanceInFlight = false;
let timerClock = defaultTimerClock;
let maintenanceRun = async (now: Date): Promise<void> => {
  await runExpiredAuthSessionCleanup(now);
  await runExpiredAnswerAttemptCleanup(now);
};

export async function runDatabaseMaintenance(now: Date = new Date()): Promise<void> {
  if (maintenanceInFlight) {
    return;
  }

  maintenanceInFlight = true;
  try {
    await maintenanceRun(now);
  } finally {
    maintenanceInFlight = false;
  }
}

export function startDatabaseMaintenanceScheduler(): void {
  if (maintenanceTimer) {
    return;
  }

  maintenanceTimer = timerClock.setInterval(() => {
    void runDatabaseMaintenance();
  }, DATABASE_MAINTENANCE_INTERVAL_MS);
  maintenanceTimer.unref?.();
}

export function stopDatabaseMaintenanceScheduler(): void {
  if (maintenanceTimer) {
    timerClock.clearInterval(maintenanceTimer);
    maintenanceTimer = null;
  }
  maintenanceInFlight = false;
}

export function setDatabaseMaintenanceRunForTests(
  next: ((now: Date) => Promise<void>) | null,
): void {
  maintenanceRun =
    next ??
    (async (now: Date): Promise<void> => {
      await runExpiredAuthSessionCleanup(now);
      await runExpiredAnswerAttemptCleanup(now);
    });
}

export function setDatabaseMaintenanceTimerClockForTests(
  next: MaintenanceTimerClock | null,
): void {
  stopDatabaseMaintenanceScheduler();
  timerClock = next ?? defaultTimerClock;
}
