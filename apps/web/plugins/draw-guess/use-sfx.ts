'use client';

import { useMemo } from 'react';
import type { DrawGuessPlayerView } from '@wanasatna/shared';
import { decideFinalCue, decidePublicCorrect } from '@/lib/game/sfx-policy';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

type Snap = {
  phase: DrawGuessPlayerView['gamePhase'];
  turnId: string;
  guessedCorrectly: boolean;
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
      eventKey: `final:draw-guess:${next.round}`,
    }),
    decidePublicCorrect({
      prevReady: true,
      wasCorrect: prev.guessedCorrectly,
      isCorrect: next.guessedCorrectly,
      eventKey: `correct:draw-guess:${next.turnId}`,
    }),
  ];
}

export function useDrawGuessSfx(
  view: DrawGuessPlayerView | null,
  playerId: string | undefined,
): void {
  const snapshot = useMemo<Snap | null>(() => {
    if (!view || !playerId) {
      return null;
    }
    return {
      phase: view.gamePhase,
      turnId: view.turnId,
      guessedCorrectly: view.guessedCorrectly,
      round: view.currentRound,
    };
  }, [view, playerId]);

  useViewTransitionSfx(snapshot, decide);
}
