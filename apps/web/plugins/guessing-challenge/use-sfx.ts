'use client';

import { useMemo } from 'react';
import type { GuessingChallengePlayerView } from '@wanasatna/shared';
import {
  decideFinalCue,
  decidePublicCorrect,
  decideRoundResult,
  decideYourTurn,
  localTeamWonMatch,
} from '@/lib/game/sfx-policy';
import { useDeadlineTimeUpSfx } from '@/lib/game/use-deadline-time-up-sfx';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

const TIMED = new Set(['playing']);

type Snap = {
  phase: GuessingChallengePlayerView['gamePhase'];
  turnId: string;
  roundId: string;
  acting: boolean;
  spectator: boolean;
  hasWinner: boolean;
  wrongCue: boolean;
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
    next.wrongCue && !prev.wrongCue && next.acting && !next.spectator
      ? { id: 'wrong' as const, eventKey: `wrong:gc:${next.turnId}` }
      : null,
    decidePublicCorrect({
      prevReady: true,
      wasCorrect: prev.hasWinner,
      isCorrect: next.hasWinner,
      eventKey: `correct:gc:${next.roundId}`,
    }),
    decideRoundResult({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      eventKey: `result:gc:${next.roundId}`,
    }),
    decideFinalCue({
      prevReady: true,
      prevPhase: prev.phase,
      phase: next.phase,
      spectator: next.spectator,
      localWon: next.localWon,
      eventKey: `final:gc:${next.round}`,
    }),
  ];
}

export function useGuessingChallengeSfx(
  view: GuessingChallengePlayerView | null,
  playerId: string | undefined,
  guessFeedback: string | null,
): void {
  useDeadlineTimeUpSfx({
    deadlineAtMs: view?.deadlineAtMs,
    enabled: Boolean(view && playerId && TIMED.has(view.gamePhase)),
    eventKey: `timeup:gc:${view?.turnId ?? 'none'}`,
    suppress: Boolean(view?.winningTeamId || view?.winningGuess),
  });

  const snapshot = useMemo<Snap | null>(() => {
    if (!view || !playerId) {
      return null;
    }
    return {
      phase: view.gamePhase,
      turnId: view.turnId,
      roundId: view.roundId,
      acting: view.isMyTurn && !view.isMatchSpectator,
      spectator: view.isMatchSpectator,
      hasWinner: Boolean(view.winningTeamId || view.winningGuess),
      wrongCue: guessFeedback === 'إجابة غير صحيحة',
      localWon: localTeamWonMatch(view.resultsLeaderboard, [
        playerId,
        view.teammate?.playerId ?? '',
      ]),
      round: view.currentRound,
    };
  }, [view, playerId, guessFeedback]);

  useViewTransitionSfx(snapshot, decide);
}
