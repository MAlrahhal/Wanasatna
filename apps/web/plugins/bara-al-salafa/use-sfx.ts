'use client';

import { useMemo } from 'react';
import type { BaraAlSalafaPlayerView } from '@wanasatna/shared';
import {
  decideFinalCue,
  decideRoundResult,
  decideTimeUp,
  decideYourTurn,
  localWonMatch,
} from '@/lib/game/sfx-policy';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

const TIMED = new Set([
  'description',
  'directed-questions',
  'free-questions',
  'voting',
  'impostor-guess',
]);

type Snap = {
  phase: BaraAlSalafaPlayerView['gamePhase'];
  remaining: number;
  turnKey: string | null;
  acting: boolean;
  spectator: boolean;
  localWon: boolean;
  round: number;
};

function actingTurnKey(view: BaraAlSalafaPlayerView): string | null {
  if (view.isMatchSpectator) {
    return null;
  }
  if (view.gamePhase === 'directed-questions' && view.isDirectedQuestionActiveAsker) {
    return `${view.currentRound}:dq:${view.directedQuestionCurrentTurn}`;
  }
  if (view.gamePhase === 'free-questions' && view.isFreeQuestionActivePlayer) {
    return `${view.currentRound}:fq:${view.activeFreeQuestionPlayerId ?? 'self'}`;
  }
  if (view.gamePhase === 'impostor-guess' && view.isImpostorGuessActivePlayer) {
    return `${view.currentRound}:ig`;
  }
  return null;
}

function decide(prev: Snap, next: Snap) {
  return [
    decideYourTurn({
      prevReady: true,
      prevTurnKey: prev.turnKey,
      acting: next.acting,
      turnKey: next.turnKey,
      spectator: next.spectator,
    }),
    decideTimeUp({
      prevReady: true,
      prevRemaining: prev.remaining,
      remaining: next.remaining,
      phase: next.phase,
      timedPhases: TIMED,
      eventKey: `timeup:bara:${next.round}:${next.phase}`,
    }),
    decideRoundResult({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      eventKey: `result:bara:${next.round}`,
    }),
    decideFinalCue({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      spectator: next.spectator,
      localWon: next.localWon,
      eventKey: `final:bara:${next.round}`,
    }),
  ];
}

export function useBaraAlSalafaSfx(
  view: BaraAlSalafaPlayerView | null,
  playerId: string | undefined,
  remaining: number,
): void {
  const snapshot = useMemo<Snap | null>(() => {
    if (!view || !playerId) {
      return null;
    }
    const turnKey = actingTurnKey(view);
    return {
      phase: view.gamePhase,
      remaining,
      turnKey,
      acting: turnKey !== null,
      spectator: view.isMatchSpectator,
      localWon: localWonMatch(view.resultsLeaderboard, playerId),
      round: view.currentRound,
    };
  }, [view, playerId, remaining]);

  useViewTransitionSfx(snapshot, decide);
}
