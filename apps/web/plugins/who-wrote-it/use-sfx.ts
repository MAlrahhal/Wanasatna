'use client';

import { useMemo } from 'react';
import type { WhoWroteItPlayerView } from '@wanasatna/shared';
import { decideFinalCue } from '@/lib/game/sfx-policy';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

type Snap = {
  phase: WhoWroteItPlayerView['gamePhase'];
  round: number;
};

function decide(prev: Snap, next: Snap) {
  return [
    decideFinalCue({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      spectator: false,
      localWon: false,
      eventKey: `final:who-wrote-it:${next.round}`,
    }),
  ];
}

export function useWhoWroteItSfx(
  view: WhoWroteItPlayerView | null,
  playerId: string | undefined,
): void {
  const snapshot = useMemo<Snap | null>(() => {
    if (!view || !playerId) {
      return null;
    }
    return {
      phase: view.gamePhase,
      round: view.currentRound,
    };
  }, [view, playerId]);

  useViewTransitionSfx(snapshot, decide);
}
