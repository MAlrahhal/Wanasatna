'use client';

import { useEffect, useRef } from 'react';
import type { TimingChallengePlayerView } from '@wanasatna/shared';
import { playGameSound } from '@/lib/game/sounds';

type PhaseSnapshot = {
  round: number;
  phase: TimingChallengePlayerView['gamePhase'];
  running: boolean;
  mode: TimingChallengePlayerView['mode'];
};

/**
 * Plays the start cue once when the authoritative timing phase begins.
 * Reconnect / remount into an already-running phase does not replay.
 */
export function useTimingStartSound(view: TimingChallengePlayerView | null): void {
  const prevRef = useRef<PhaseSnapshot | null>(null);

  useEffect(() => {
    if (!view) {
      return;
    }

    const prev = prevRef.current;
    const next: PhaseSnapshot = {
      round: view.currentRound,
      phase: view.gamePhase,
      running: view.selfTimerRunning,
      mode: view.mode,
    };
    prevRef.current = next;

    if (!prev) {
      // Initial mount / reconnect — do not invent a start cue.
      return;
    }

    if (
      view.mode === 'guess-time' &&
      view.gamePhase === 'hidden-timing' &&
      prev.round === view.currentRound &&
      prev.phase === 'ready'
    ) {
      playGameSound('timer-start');
      return;
    }

    if (
      view.mode === 'stop-timer' &&
      view.gamePhase === 'stop-timer' &&
      view.selfTimerRunning &&
      prev.round === view.currentRound &&
      !prev.running
    ) {
      playGameSound('timer-start');
    }
  }, [view]);
}
