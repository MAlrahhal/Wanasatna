'use client';

import { useMemo } from 'react';
import type { GuessingChallengePlayerView } from '@wanasatna/shared';
import { decideFinalCue, decidePublicCorrect } from '@/lib/game/sfx-policy';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

type Snap = {
  phase: GuessingChallengePlayerView['gamePhase'];
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
      eventKey: `final:gc:${next.round}`,
    }),
    decidePublicCorrect({
      prevReady: true,
      wasCorrect: prev.hasWinner,
      isCorrect: next.hasWinner,
      eventKey: `correct:gc:${next.roundId}`,
    }),
  ];
}

export function useGuessingChallengeSfx(
  view: GuessingChallengePlayerView | null,
  playerId: string | undefined,
  _guessFeedback: string | null,
): void {
  const snapshot = useMemo<Snap | null>(() => {
    if (!view || !playerId) {
      return null;
    }
    return {
      phase: view.gamePhase,
      roundId: view.roundId,
      hasWinner: Boolean(view.winningTeamId || view.winningGuess),
      round: view.currentRound,
    };
  }, [view, playerId]);

  useViewTransitionSfx(snapshot, decide);
}
