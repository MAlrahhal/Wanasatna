'use client';

import { useMemo } from 'react';
import type { ImposterDrawPlayerView } from '@wanasatna/shared';
import {
  decideFinalCue,
  decideYourTurn,
  localWonMatch,
} from '@/lib/game/sfx-policy';
import { useDeadlineTimeUpSfx } from '@/lib/game/use-deadline-time-up-sfx';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

const TIMED = new Set(['drawing-turns', 'voting', 'impostor-guess']);
const RESULT_PHASES = new Set(['reveal', 'round-results']);

type Snap = {
  phase: ImposterDrawPlayerView['gamePhase'];
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
