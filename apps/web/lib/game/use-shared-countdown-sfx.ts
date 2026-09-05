'use client';

import { useLayoutEffect, useRef } from 'react';
import { useGameShell } from '@/contexts/game-shell-context';
import { isGameAudioUnlocked, playGameSound, preloadGameSound } from '@/lib/game/sounds';

const UNLOCK_RETRY_FRAMES = 10;

function playCountdown(eventKey: string): void {
  playGameSound('countdown-tick', { eventKey });
  if (isGameAudioUnlocked() || typeof requestAnimationFrame !== 'function') {
    return;
  }

  let frames = 0;
  const retry = () => {
    frames += 1;
    playGameSound('countdown-tick', { eventKey });
    if (!isGameAudioUnlocked() && frames < UNLOCK_RETRY_FRAMES) {
      requestAnimationFrame(retry);
    }
  };
  requestAnimationFrame(retry);
}

/**
 * Plays the Mixkit 3-2-1-GO sting once, in layout, when visual `3` first appears.
 * Reconnect / remount into an already-running countdown does not replay.
 */
export function useSharedCountdownSfx(): void {
  const { state } = useGameShell();
  const prevRef = useRef<{ phase: string | null; remaining: number | null }>({
    phase: null,
    remaining: null,
  });

  useLayoutEffect(() => {
    const phase = state?.phase ?? null;
    const remaining = state?.countdownRemainingSeconds ?? null;

    if (phase === 'WAITING' || phase === 'COUNTDOWN') {
      preloadGameSound('countdown-tick');
    }

    const prev = prevRef.current;
    prevRef.current = { phase, remaining };

    const showingThree = phase === 'COUNTDOWN' && remaining != null && remaining >= 3;
    if (!showingThree || !state?.shellId) {
      return;
    }

    const alreadyOnThree =
      prev.phase === 'COUNTDOWN' && prev.remaining != null && prev.remaining >= 3;
    if (alreadyOnThree || prev.phase == null) {
      return;
    }

    playCountdown(`countdown:${state.gameId ?? 'game'}:${state.shellId}`);
  }, [state?.phase, state?.countdownRemainingSeconds, state?.shellId, state?.gameId]);
}
