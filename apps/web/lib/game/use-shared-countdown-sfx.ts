'use client';

import { useEffect, useRef } from 'react';
import { useGameShell } from '@/contexts/game-shell-context';
import { playGameSound } from '@/lib/game/sounds';
import { decideCountdownTick, type CountdownCursor } from '@/lib/game/sfx-policy';

/** Shared 3-2-1 game-start countdown. Plays the Mixkit sting once when 3 appears. */
export function useSharedCountdownSfx(): void {
  const { state } = useGameShell();
  const prevRef = useRef<CountdownCursor>(null);

  useEffect(() => {
    const inCountdown = state?.phase === 'COUNTDOWN';
    const decided = decideCountdownTick(
      prevRef.current,
      inCountdown,
      state?.countdownRemainingSeconds ?? null,
    );
    prevRef.current = decided.next;
    if (decided.play === 3 && state?.shellId) {
      playGameSound('countdown-tick', {
        eventKey: `countdown:${state.gameId ?? 'game'}:${state.shellId}`,
      });
    }
  }, [state?.phase, state?.countdownRemainingSeconds, state?.shellId, state?.gameId]);
}
