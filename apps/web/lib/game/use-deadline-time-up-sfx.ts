'use client';

import { useEffect, useRef } from 'react';
import {
  DEADLINE_CLOCK_INTERVAL_MS,
  remainingSecondsFromDeadline,
} from '@/lib/game/deadline-clock';
import { playGameSound } from '@/lib/game/sounds';

/** Plays time-up without lifting remaining seconds into a parent render. */
export function useDeadlineTimeUpSfx(options: {
  deadlineAtMs: number | null | undefined;
  enabled: boolean;
  eventKey: string;
  suppress?: boolean;
}): void {
  const { deadlineAtMs, enabled, eventKey, suppress = false } = options;
  const previousRemainingRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || deadlineAtMs == null) {
      previousRemainingRef.current = null;
      return;
    }

    const tick = () => {
      const remaining = remainingSecondsFromDeadline(deadlineAtMs);
      const previous = previousRemainingRef.current;
      previousRemainingRef.current = remaining;

      if (suppress || previous == null) {
        return;
      }

      if (previous > 0 && remaining === 0) {
        playGameSound('time-up', { eventKey });
      }
    };

    tick();
    const intervalId = window.setInterval(tick, DEADLINE_CLOCK_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [deadlineAtMs, enabled, eventKey, suppress]);
}
