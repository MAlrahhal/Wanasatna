'use client';

import { useMemo } from 'react';
import type { DrawGuessPlayerView } from '@wanasatna/shared';
import {
  decideFinalCue,
  decidePublicCorrect,
  decideRoundResult,
  decideYourTurn,
  localWonMatch,
} from '@/lib/game/sfx-policy';
import { useDeadlineTimeUpSfx } from '@/lib/game/use-deadline-time-up-sfx';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

const DRAW_TIMED = new Set(['drawing']);

type Snap = {
  phase: DrawGuessPlayerView['gamePhase'];
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
): void {
  useDeadlineTimeUpSfx({
    deadlineAtMs: view?.deadlineAtMs,
    enabled: Boolean(view && playerId && DRAW_TIMED.has(view.gamePhase)),
    eventKey: `timeup:draw-guess:${view?.turnId ?? 'none'}`,
    suppress: Boolean(view?.guessedCorrectly),
  });

  const snapshot = useMemo<Snap | null>(() => {
    if (!view || !playerId) {
      return null;
    }
    return {
      phase: view.gamePhase,
      turnId: view.turnId,
      acting: view.role === 'drawer' && view.gamePhase === 'drawing' && !view.isMatchSpectator,
      spectator: view.isMatchSpectator,
      guessedCorrectly: view.guessedCorrectly,
      localWon: localWonMatch(view.resultsLeaderboard, playerId),
      round: view.currentRound,
    };
  }, [view, playerId]);

  useViewTransitionSfx(snapshot, decide);
}
