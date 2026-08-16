/** Display/SYNC remaining seconds from an absolute phase deadline. */
export function remainingSecondsFromDeadline(
  deadlineAtMs: number | null | undefined,
  now = Date.now(),
): number {
  if (deadlineAtMs == null) {
    return 0;
  }

  return Math.max(0, Math.ceil((deadlineAtMs - now) / 1000));
}

export function remainingMsUntilDeadline(
  deadlineAtMs: number | null | undefined,
  fallbackSeconds: number,
  now = Date.now(),
): number {
  if (deadlineAtMs != null) {
    return Math.max(0, deadlineAtMs - now);
  }

  return Math.max(0, fallbackSeconds * 1000);
}

/** Pair stored remaining seconds with an absolute deadline. Does not change duration. */
export function timedPhaseClock(seconds: number, now = Date.now()) {
  const phaseRemainingSeconds = Math.max(0, seconds);

  return {
    phaseRemainingSeconds,
    deadlineAtMs: now + phaseRemainingSeconds * 1000,
  };
}
