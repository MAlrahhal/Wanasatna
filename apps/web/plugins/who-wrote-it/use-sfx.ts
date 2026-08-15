'use client';

import { useMemo } from 'react';
import type { WhoWroteItPlayerView } from '@wanasatna/shared';
import {
  decideFinalCue,
  decideRoundResult,
  decideTimeUp,
  localWonMatch,
} from '@/lib/game/sfx-policy';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

const TIMED = new Set(['answering', 'guessing']);

type Snap = {
  phase: WhoWroteItPlayerView['gamePhase'];
  remaining: number;
  roundId: string;
  spectator: boolean;
  localWon: boolean;
  localCorrect: boolean;
  round: number;
};

function decide(prev: Snap, next: Snap) {
  return [
    decideTimeUp({
      prevReady: true,
      prevRemaining: prev.remaining,
      remaining: next.remaining,
      phase: next.phase,
      timedPhases: TIMED,
      eventKey: `timeup:who-wrote-it:${next.roundId}:${next.phase}`,
    }),
    decideRoundResult({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      eventKey: `result:who-wrote-it:${next.roundId}`,
    }),
    next.phase === 'round-results' &&
    prev.phase !== 'round-results' &&
    next.localCorrect &&
    !next.spectator
      ? { id: 'correct' as const, eventKey: `correct:who-wrote-it:${next.roundId}` }
      : null,
    decideFinalCue({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      spectator: next.spectator,
      localWon: next.localWon,
      eventKey: `final:who-wrote-it:${next.round}`,
    }),
  ];
}

export function useWhoWroteItSfx(
  view: WhoWroteItPlayerView | null,
  playerId: string | undefined,
  remaining: number,
): void {
  const snapshot = useMemo<Snap | null>(() => {
    if (!view || !playerId) {
      return null;
    }
    return {
      phase: view.gamePhase,
      remaining,
      roundId: view.roundId ?? `r${view.currentRound}`,
      spectator: view.isMatchSpectator,
      localWon: localWonMatch(view.resultsLeaderboard, playerId),
      localCorrect:
        (view.roundResults.find((entry) => entry.playerId === playerId)?.correctCount ?? 0) > 0,
      round: view.currentRound,
    };
  }, [view, playerId, remaining]);

  useViewTransitionSfx(snapshot, decide);
}
