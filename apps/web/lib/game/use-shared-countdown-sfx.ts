'use client';

import { useEffect, useRef } from 'react';
import { useGameShell } from '@/contexts/game-shell-context';
import { playGameSound } from '@/lib/game/sounds';
import { decideCountdownTick, type CountdownCursor } from '@/lib/game/sfx-policy';

/** Shared 3-2-1 countdown ticks. Spectators may hear. Reconnect into an active count is silent. */
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
    if (decided.play != null && state?.shellId) {
      playGameSound('countdown-tick', {
        eventKey: `countdown:${state.gameId ?? 'game'}:${state.shellId}:${decided.play}`,
      });
    }
  }, [state?.phase, state?.countdownRemainingSeconds, state?.shellId, state?.gameId]);
}
