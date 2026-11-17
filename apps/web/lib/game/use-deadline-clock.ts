'use client';

import { useEffect, useState } from 'react';
import {
  advanceDeadlineClock,
  DEADLINE_CLOCK_INTERVAL_MS,
  remainingSecondsFromDeadline,
} from '@/lib/game/deadline-clock';

/** Local display clock derived from an absolute deadline. Does not own phase expiry. */
export function useDeadlineClock(
  deadlineAtMs: number | null | undefined,
  intervalMs: number = DEADLINE_CLOCK_INTERVAL_MS,
): number {
  const [clock, setClock] = useState(() => ({
    deadlineAtMs: deadlineAtMs ?? null,
    remainingSeconds: deadlineAtMs == null ? 0 : remainingSecondsFromDeadline(deadlineAtMs),
  }));

  useEffect(() => {
    if (deadlineAtMs == null) {
      const resetId = window.setTimeout(() => {
        setClock({ deadlineAtMs: null, remainingSeconds: 0 });
      }, 0);
      return () => window.clearTimeout(resetId);
    }

    const update = () => {
      setClock((current) => advanceDeadlineClock(current, deadlineAtMs));
    };

    const updateWhenVisible = () => {
      if (document.visibilityState === 'visible') update();
    };

    const intervalId = window.setInterval(update, intervalMs);
    document.addEventListener('visibilitychange', updateWhenVisible);
    window.addEventListener('focus', update);
    window.addEventListener('pageshow', update);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', updateWhenVisible);
      window.removeEventListener('focus', update);
      window.removeEventListener('pageshow', update);
    };
  }, [deadlineAtMs, intervalMs]);

  return clock.deadlineAtMs === (deadlineAtMs ?? null)
    ? clock.remainingSeconds
    : deadlineAtMs == null
      ? 0
      : remainingSecondsFromDeadline(deadlineAtMs);
}
