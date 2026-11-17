import type { GameExperienceTimer } from '@/lib/game/shell-types';

export const DEADLINE_CLOCK_INTERVAL_MS = 250;

export type DeadlineClockState = {
  deadlineAtMs: number | null;
  remainingSeconds: number;
};

export function remainingSecondsFromDeadline(
  deadlineAtMs: number,
  nowMs: number = Date.now(),
): number {
  return Math.max(0, Math.ceil((deadlineAtMs - nowMs) / 1000));
}

/**
 * A deadline change starts a new authoritative phase clock. For the same
 * deadline, the displayed value can only move down, even if Date.now() moves
 * backwards or an older render tries to restore more time.
 */
export function advanceDeadlineClock(
  current: DeadlineClockState,
  deadlineAtMs: number | null | undefined,
  nowMs: number = Date.now(),
): DeadlineClockState {
  const normalizedDeadline = deadlineAtMs ?? null;
  if (normalizedDeadline === null) {
    return { deadlineAtMs: null, remainingSeconds: 0 };
  }
  const nextRemaining = remainingSecondsFromDeadline(normalizedDeadline, nowMs);
  if (current.deadlineAtMs !== normalizedDeadline) {
    return { deadlineAtMs: normalizedDeadline, remainingSeconds: nextRemaining };
  }
  return {
    deadlineAtMs: normalizedDeadline,
    remainingSeconds: Math.min(current.remainingSeconds, nextRemaining),
  };
}

/** Stable shell timer config. Display ticks stay inside DeadlineTimerChip. */
export function toExperienceTimer(
  deadlineAtMs: number | null | undefined,
  options?: Pick<GameExperienceTimer, 'format' | 'lowTimeThreshold'>,
): GameExperienceTimer | undefined {
  if (deadlineAtMs == null) {
    return undefined;
  }

  return {
    deadlineAtMs,
    format: options?.format,
    lowTimeThreshold: options?.lowTimeThreshold,
  };
}
