'use client';

import { useLayoutEffect, useRef } from 'react';
import type { TimingChallengePlayerView } from '@wanasatna/shared';
import type { GameSoundId } from '@/lib/game/sounds';
import { isGameAudioUnlocked, playGameSound } from '@/lib/game/sounds';
import {
  shouldPlayTimingEndSound,
  shouldPlayTimingStartSound,
  timingEndEventKey,
  timingStartEventKey,
  type TimingWindowSfxSnapshot,
} from './timing-window-sfx';

const UNLOCK_RETRY_FRAMES = 10;

/**
 * Feedback-only: never delays the timer. Retries briefly if the same-gesture
 * unlock from Ready / Start has not finished when the view transition lands.
 */
function playTimingCue(id: GameSoundId, eventKey: string): void {
  playGameSound(id, { eventKey });
  if (isGameAudioUnlocked() || typeof requestAnimationFrame !== 'function') {
    return;
  }

  let frames = 0;
  const retry = () => {
    frames += 1;
    playGameSound(id, { eventKey });
    if (!isGameAudioUnlocked() && frames < UNLOCK_RETRY_FRAMES) {
      requestAnimationFrame(retry);
    }
  };
  requestAnimationFrame(retry);
}

function snapshotFromView(view: TimingChallengePlayerView): TimingWindowSfxSnapshot {
  return {
    round: view.currentRound,
    phase: view.gamePhase,
    running: view.selfTimerRunning,
    mode: view.mode,
  };
}

/**
 * Plays start/end cues once on client timing-window transitions.
 * Reconnect / remount into an already-running (or already-ended) window does not replay.
 * Layout effect keeps the cue on the same frame as the timer UI, before paint.
 */
export function useTimingStartSound(view: TimingChallengePlayerView | null): void {
  const prevRef = useRef<TimingWindowSfxSnapshot | null>(null);

  useLayoutEffect(() => {
    if (!view) {
      return;
    }

    const prev = prevRef.current;
    const next = snapshotFromView(view);
    prevRef.current = next;

    if (!prev) {
      return;
    }

    if (shouldPlayTimingStartSound(prev, next)) {
      playTimingCue('go', timingStartEventKey(view.roundId, view.mode));
      return;
    }

    if (shouldPlayTimingEndSound(prev, next)) {
      playTimingCue('time-up', timingEndEventKey(view.roundId));
    }
  }, [view]);
}
