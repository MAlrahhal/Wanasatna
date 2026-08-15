'use client';

import { useMemo } from 'react';
import type { DrawGuessPlayerView } from '@wanasatna/shared';
import {
  decideFinalCue,
  decidePublicCorrect,
  decideRoundResult,
  decideTimeUp,
  decideYourTurn,
  localWonMatch,
} from '@/lib/game/sfx-policy';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

const DRAW_TIMED = new Set(['drawing']);

type Snap = {
  phase: DrawGuessPlayerView['gamePhase'];
  remaining: number;
  turnId: string;
  acting: boolean;
  spectator: boolean;
  guessedCorrectly: boolean;
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
    decidePublicCorrect({
      prevReady: true,
      wasCorrect: prev.guessedCorrectly,
      isCorrect: next.guessedCorrectly,
      eventKey: `correct:draw-guess:${next.turnId}`,
    }),
    decideTimeUp({
      prevReady: true,
      prevRemaining: prev.remaining,
      remaining: next.remaining,
      phase: next.phase,
      timedPhases: DRAW_TIMED,
      eventKey: `timeup:draw-guess:${next.turnId}`,
      suppress: next.guessedCorrectly,
    }),
    decideRoundResult({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      eventKey: `result:draw-guess:${next.round}`,
    }),
    decideFinalCue({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      spectator: next.spectator,
      localWon: next.localWon,
      eventKey: `final:draw-guess:${next.round}`,
    }),
  ];
}

export function useDrawGuessSfx(
  view: DrawGuessPlayerView | null,
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
      acting: view.role === 'drawer' && view.gamePhase === 'drawing' && !view.isMatchSpectator,
      spectator: view.isMatchSpectator,
      guessedCorrectly: view.guessedCorrectly,
      localWon: localWonMatch(view.resultsLeaderboard, playerId),
      round: view.currentRound,
    };
  }, [view, playerId, remaining]);

  useViewTransitionSfx(snapshot, decide);
}
