'use client';

import { useEffect, useState } from 'react';
import {
  DEADLINE_CLOCK_INTERVAL_MS,
  remainingSecondsFromDeadline,
} from '@/lib/game/deadline-clock';

/** Local display clock derived from an absolute deadline. Does not own phase expiry. */
export function useDeadlineClock(
  deadlineAtMs: number | null | undefined,
  intervalMs: number = DEADLINE_CLOCK_INTERVAL_MS,
): number {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    deadlineAtMs == null ? 0 : remainingSecondsFromDeadline(deadlineAtMs),
  );

  useEffect(() => {
    if (deadlineAtMs == null) {
      setRemainingSeconds(0);
      return;
    }

    const update = () => {
      setRemainingSeconds(remainingSecondsFromDeadline(deadlineAtMs));
    };

    update();
    const intervalId = window.setInterval(update, intervalMs);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [deadlineAtMs, intervalMs]);

  return remainingSeconds;
}
