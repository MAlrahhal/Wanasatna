import type { GameExperienceTimer } from '@/lib/game/shell-types';

export const DEADLINE_CLOCK_INTERVAL_MS = 250;

export function remainingSecondsFromDeadline(
  deadlineAtMs: number,
  nowMs: number = Date.now(),
): number {
  return Math.max(0, Math.ceil((deadlineAtMs - nowMs) / 1000));
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
