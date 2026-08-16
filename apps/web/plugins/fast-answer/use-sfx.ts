'use client';

import { useMemo } from 'react';
import type { FastAnswerPlayerView } from '@wanasatna/shared';
import {
  decideFinalCue,
  decidePublicCorrect,
  decideRoundResult,
  localWonMatch,
} from '@/lib/game/sfx-policy';
import { useDeadlineTimeUpSfx } from '@/lib/game/use-deadline-time-up-sfx';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';
import { resolveFastAnswerDeadlineAtMs } from './use-player-view';

const TIMED = new Set(['question']);

type Snap = {
  phase: FastAnswerPlayerView['gamePhase'];
  roundId: string;
  spectator: boolean;
  hasWinner: boolean;
  timedOut: boolean;
  localWon: boolean;
  round: number;
};

function decide(prev: Snap, next: Snap) {
  return [
    decidePublicCorrect({
      prevReady: true,
      wasCorrect: prev.hasWinner,
      isCorrect: next.hasWinner,
      eventKey: `correct:fast-answer:${next.roundId}`,
    }),
    next.timedOut && !prev.timedOut && next.phase === 'round-results' && !next.hasWinner
      ? { id: 'time-up' as const, eventKey: `timeup:fast-answer:${next.roundId}` }
      : null,
    decideRoundResult({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      eventKey: `result:fast-answer:${next.roundId}`,
    }),
    decideFinalCue({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      spectator: next.spectator,
      localWon: next.localWon,
      eventKey: `final:fast-answer:${next.round}`,
    }),
  ];
}

export function useFastAnswerSfx(
  view: FastAnswerPlayerView | null,
  playerId: string | undefined,
): void {
  const roundId = view?.roundId ?? `r${view?.currentRound ?? 0}`;
  useDeadlineTimeUpSfx({
    deadlineAtMs: resolveFastAnswerDeadlineAtMs(view),
    enabled: Boolean(view && playerId && TIMED.has(view.gamePhase)),
    eventKey: `timeup:fast-answer:${roundId}`,
    suppress: Boolean(view?.winnerPlayerId),
  });

  const snapshot = useMemo<Snap | null>(() => {
    if (!view || !playerId) {
      return null;
    }
    return {
      phase: view.gamePhase,
      roundId: view.roundId ?? `r${view.currentRound}`,
      spectator: view.isMatchSpectator,
      hasWinner: Boolean(view.winnerPlayerId),
      timedOut: view.timedOut,
      localWon: localWonMatch(view.resultsLeaderboard, playerId),
      round: view.currentRound,
    };
  }, [view, playerId]);

  useViewTransitionSfx(snapshot, decide);
}
