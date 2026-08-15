'use client';

import { useEffect, useRef } from 'react';
import type { GameSoundId } from '@/lib/game/sounds';
import { playGameSound } from '@/lib/game/sounds';
import type { SfxCue } from '@/lib/game/sfx-policy';

export function playSfxCues(cues: Array<SfxCue | null | undefined>): void {
  for (const cue of cues) {
    if (cue) {
      playGameSound(cue.id, { eventKey: cue.eventKey });
    }
  }
}

export function useViewTransitionSfx<T>(
  snapshot: T | null,
  decide: (prev: T, next: T) => Array<SfxCue | null | undefined>,
): void {
  const prevRef = useRef<T | null>(null);

  const decideRef = useRef(decide);
  decideRef.current = decide;

  useEffect(() => {
    if (!snapshot) {
      prevRef.current = null;
      return;
    }
    const prev = prevRef.current;
    prevRef.current = snapshot;
    if (!prev) {
      return;
    }
    playSfxCues(decideRef.current(prev, snapshot));
  }, [snapshot]);
}

export function playSfx(id: GameSoundId, eventKey: string): void {
  playGameSound(id, { eventKey });
}
