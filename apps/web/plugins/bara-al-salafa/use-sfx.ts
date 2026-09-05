'use client';

import { useMemo } from 'react';
import type { BaraAlSalafaPlayerView } from '@wanasatna/shared';
import { decideFinalCue } from '@/lib/game/sfx-policy';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

type Snap = {
  phase: BaraAlSalafaPlayerView['gamePhase'];
  round: number;
};

function decide(prev: Snap, next: Snap) {
  return [
    next.phase === 'reveal-impostor' && prev.phase !== 'reveal-impostor'
      ? { id: 'imposter-reveal' as const, eventKey: `reveal:bara:${next.round}` }
      : null,
    decideFinalCue({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      spectator: false,
      localWon: false,
      eventKey: `final:bara:${next.round}`,
    }),
  ];
}

export function useBaraAlSalafaSfx(
  view: BaraAlSalafaPlayerView | null,
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
