'use client';

import { useMemo } from 'react';
import type { JudgePlayerView } from '@wanasatna/shared';
import {
  decideFinalCue,
  decidePublicCorrect,
  decideRoundResult,
  decideTimeUp,
  decideYourTurn,
  localWonMatch,
} from '@/lib/game/sfx-policy';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

const TIMED = new Set(['answering', 'judging']);

type Snap = {
  phase: JudgePlayerView['gamePhase'];
  remaining: number;
  roundId: string;
  acting: boolean;
  spectator: boolean;
  hasWinner: boolean;
  localWon: boolean;
  round: number;
};

function decide(prev: Snap, next: Snap) {
  return [
    decideYourTurn({
      prevReady: true,
      prevTurnKey: prev.acting ? `${prev.roundId}:judge` : null,
      acting: next.acting,
      turnKey: `${next.roundId}:judge`,
      spectator: next.spectator,
    }),
    decidePublicCorrect({
      prevReady: true,
      wasCorrect: prev.hasWinner,
      isCorrect: next.hasWinner,
      eventKey: `correct:judge:${next.roundId}`,
    }),
    decideTimeUp({
      prevReady: true,
      prevRemaining: prev.remaining,
      remaining: next.remaining,
      phase: next.phase,
      timedPhases: TIMED,
      eventKey: `timeup:judge:${next.roundId}:${next.phase}`,
      suppress: next.hasWinner,
    }),
    decideRoundResult({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      eventKey: `result:judge:${next.roundId}`,
    }),
    decideFinalCue({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      spectator: next.spectator,
      localWon: next.localWon,
      eventKey: `final:judge:${next.round}`,
    }),
  ];
}

export function useJudgeSfx(
  view: JudgePlayerView | null,
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
      acting: view.isJudge && view.gamePhase === 'judging' && !view.isMatchSpectator,
      spectator: view.isMatchSpectator,
      hasWinner: Boolean(view.winnerName),
      localWon: localWonMatch(view.resultsLeaderboard, playerId),
      round: view.currentRound,
    };
  }, [view, playerId, remaining]);

  useViewTransitionSfx(snapshot, decide);
}
