'use client';

import { useMemo } from 'react';
import type { BaraAlSalafaPlayerView } from '@wanasatna/shared';
import {
  decideFinalCue,
  decideRoundResult,
  decideYourTurn,
  localWonMatch,
} from '@/lib/game/sfx-policy';
import { useDeadlineTimeUpSfx } from '@/lib/game/use-deadline-time-up-sfx';
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
): void {
  useDeadlineTimeUpSfx({
    deadlineAtMs: view?.deadlineAtMs,
    enabled: Boolean(view && playerId && TIMED.has(view.gamePhase)),
    eventKey: `timeup:bara:${view?.currentRound ?? 0}:${view?.gamePhase ?? 'none'}`,
  });

  const snapshot = useMemo<Snap | null>(() => {
    if (!view || !playerId) {
      return null;
    }
    const turnKey = actingTurnKey(view);
    return {
      phase: view.gamePhase,
      turnKey,
      acting: turnKey !== null,
      spectator: view.isMatchSpectator,
      localWon: localWonMatch(view.resultsLeaderboard, playerId),
      round: view.currentRound,
    };
  }, [view, playerId]);

  useViewTransitionSfx(snapshot, decide);
}
