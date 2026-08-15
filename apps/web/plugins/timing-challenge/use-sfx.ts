'use client';

import { useMemo } from 'react';
import type { TimingChallengePlayerView } from '@wanasatna/shared';
import { decideFinalCue, decideRoundResult, localWonMatch } from '@/lib/game/sfx-policy';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

type Snap = {
  phase: TimingChallengePlayerView['gamePhase'];
  spectator: boolean;
  localWon: boolean;
  roundId: string;
  round: number;
};

function decide(prev: Snap, next: Snap) {
  return [
    decideRoundResult({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      eventKey: `result:timing:${next.roundId}`,
    }),
    decideFinalCue({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      spectator: next.spectator,
      localWon: next.localWon,
      eventKey: `final:timing:${next.round}`,
    }),
  ];
}

export function useTimingChallengeSfx(
  view: TimingChallengePlayerView | null,
  playerId: string | undefined,
): void {
  const snapshot = useMemo<Snap | null>(() => {
    if (!view || !playerId) {
      return null;
    }
    return {
      phase: view.gamePhase,
      spectator: view.isMatchSpectator,
      localWon: localWonMatch(view.resultsLeaderboard, playerId),
      roundId: view.roundId,
      round: view.currentRound,
    };
  }, [view, playerId]);

  useViewTransitionSfx(snapshot, decide);
}
