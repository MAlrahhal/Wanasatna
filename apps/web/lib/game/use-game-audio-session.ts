'use client';

import { useEffect } from 'react';
import { clearGameAudioEventKeys, stopAllGameSounds, unlockGameAudio } from '@/lib/game/sounds';

const listenerOptions: AddEventListenerOptions = { capture: true, passive: true };

/** Passive room-session unlock + cleanup. Does not intercept gameplay pointers. */
export function useGameAudioSession(): void {
  useEffect(() => {
    const onInteract = (): void => {
      unlockGameAudio();
    };

    const onVisibility = (): void => {
      // New SFX are gated by document.hidden; returning to the tab does not replay.
    };

    window.addEventListener('pointerdown', onInteract, listenerOptions);
    window.addEventListener('keydown', onInteract, listenerOptions);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('pointerdown', onInteract, listenerOptions);
      window.removeEventListener('keydown', onInteract, listenerOptions);
      document.removeEventListener('visibilitychange', onVisibility);
      stopAllGameSounds();
      clearGameAudioEventKeys();
    };
  }, []);
}
