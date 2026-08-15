'use client';

import { useMemo } from 'react';
import type { ImposterDrawPlayerView } from '@wanasatna/shared';
import {
  decideFinalCue,
  decideTimeUp,
  decideYourTurn,
  localWonMatch,
} from '@/lib/game/sfx-policy';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

const TIMED = new Set(['drawing-turns', 'voting', 'impostor-guess']);
const RESULT_PHASES = new Set(['reveal', 'round-results']);

type Snap = {
  phase: ImposterDrawPlayerView['gamePhase'];
  remaining: number;
  turnId: string;
  acting: boolean;
  spectator: boolean;
  localWon: boolean;
  round: number;
};

function decide(prev: Snap, next: Snap) {
  const enteredResult = RESULT_PHASES.has(next.phase) && !RESULT_PHASES.has(prev.phase);
  return [
    decideYourTurn({
      prevReady: true,
      prevTurnKey: prev.acting ? prev.turnId : null,
      acting: next.acting,
      turnKey: next.turnId,
      spectator: next.spectator,
    }),
    decideTimeUp({
      prevReady: true,
      prevRemaining: prev.remaining,
      remaining: next.remaining,
      phase: next.phase,
      timedPhases: TIMED,
      eventKey: `timeup:imposter-draw:${next.turnId}:${next.phase}`,
    }),
    enteredResult
      ? { id: 'round-result' as const, eventKey: `result:imposter-draw:${next.round}` }
      : null,
    decideFinalCue({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      spectator: next.spectator,
      localWon: next.localWon,
      eventKey: `final:imposter-draw:${next.round}`,
    }),
  ];
}

export function useImposterDrawSfx(
  view: ImposterDrawPlayerView | null,
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
      turnId: view.turnId,
      acting: view.canDraw && !view.isMatchSpectator,
      spectator: view.isMatchSpectator,
      localWon: localWonMatch(view.resultsLeaderboard, playerId),
      round: view.currentRound,
    };
  }, [view, playerId, remaining]);

  useViewTransitionSfx(snapshot, decide);
}
