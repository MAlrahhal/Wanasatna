'use client';

import { useMemo } from 'react';
import type { FastAnswerPlayerView } from '@wanasatna/shared';
import { decideFinalCue, decidePublicCorrect } from '@/lib/game/sfx-policy';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

type Snap = {
  phase: FastAnswerPlayerView['gamePhase'];
  roundId: string;
  hasWinner: boolean;
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
      eventKey: `final:fast-answer:${next.round}`,
    }),
    decidePublicCorrect({
      prevReady: true,
      wasCorrect: prev.hasWinner,
      isCorrect: next.hasWinner,
      eventKey: `correct:fast-answer:${next.roundId}`,
    }),
  ];
}

export function useFastAnswerSfx(
  view: FastAnswerPlayerView | null,
  playerId: string | undefined,
): void {
  const snapshot = useMemo<Snap | null>(() => {
    if (!view || !playerId) {
      return null;
    }
    return {
      phase: view.gamePhase,
      roundId: view.roundId ?? `r${view.currentRound}`,
      hasWinner: Boolean(view.winnerPlayerId),
      round: view.currentRound,
    };
  }, [view, playerId]);

  useViewTransitionSfx(snapshot, decide);
}
