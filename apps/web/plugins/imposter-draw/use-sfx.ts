'use client';

import { useMemo } from 'react';
import type { ImposterDrawPlayerView } from '@wanasatna/shared';
import {
  decideFinalCue,
  decideRoundResult,
  decideYourTurn,
  localWonMatch,
} from '@/lib/game/sfx-policy';
import { useDeadlineTimeUpSfx } from '@/lib/game/use-deadline-time-up-sfx';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

const TIMED = new Set(['drawing-turns', 'voting', 'impostor-guess']);

type Snap = {
  phase: ImposterDrawPlayerView['gamePhase'];
  turnId: string;
  acting: boolean;
  spectator: boolean;
  localWon: boolean;
  round: number;
};

function decide(prev: Snap, next: Snap) {
  return [
    decideYourTurn({
      prevReady: true,
      prevTurnKey: prev.acting ? prev.turnId : null,
      acting: next.acting,
      turnKey: next.turnId,
      spectator: next.spectator,
    }),
    next.phase === 'reveal' && prev.phase !== 'reveal'
      ? { id: 'imposter-reveal' as const, eventKey: `reveal:imposter-draw:${next.round}` }
      : null,
    decideRoundResult({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      eventKey: `result:imposter-draw:${next.round}`,
    }),
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
): void {
  useDeadlineTimeUpSfx({
    deadlineAtMs: view?.deadlineAtMs,
    enabled: Boolean(view && playerId && TIMED.has(view.gamePhase)),
    eventKey: `timeup:imposter-draw:${view?.turnId ?? 'none'}:${view?.gamePhase ?? 'none'}`,
  });

  const snapshot = useMemo<Snap | null>(() => {
    if (!view || !playerId) {
      return null;
    }
    return {
      phase: view.gamePhase,
      turnId: view.turnId,
      acting: view.canDraw && !view.isMatchSpectator,
      spectator: view.isMatchSpectator,
      localWon: localWonMatch(view.resultsLeaderboard, playerId),
      round: view.currentRound,
    };
  }, [view, playerId]);

  useViewTransitionSfx(snapshot, decide);
}
