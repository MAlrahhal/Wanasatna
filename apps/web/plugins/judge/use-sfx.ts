'use client';

import { useMemo } from 'react';
import type { JudgePlayerView } from '@wanasatna/shared';
import { decideFinalCue } from '@/lib/game/sfx-policy';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

type Snap = {
  phase: JudgePlayerView['gamePhase'];
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
      eventKey: `final:judge:${next.round}`,
    }),
  ];
}

export function useJudgeSfx(
  view: JudgePlayerView | null,
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
