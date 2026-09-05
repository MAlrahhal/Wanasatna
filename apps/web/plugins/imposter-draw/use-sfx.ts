'use client';

import { useMemo } from 'react';
import type { ImposterDrawPlayerView } from '@wanasatna/shared';
import { decideFinalCue } from '@/lib/game/sfx-policy';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

type Snap = {
  phase: ImposterDrawPlayerView['gamePhase'];
  round: number;
};

function decide(prev: Snap, next: Snap) {
  return [
    next.phase === 'reveal' && prev.phase !== 'reveal'
      ? { id: 'imposter-reveal' as const, eventKey: `reveal:imposter-draw:${next.round}` }
      : null,
    decideFinalCue({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      spectator: false,
      localWon: false,
      eventKey: `final:imposter-draw:${next.round}`,
    }),
  ];
}

export function useImposterDrawSfx(
  view: ImposterDrawPlayerView | null,
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
