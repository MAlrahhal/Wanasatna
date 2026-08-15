'use client';

import { useMemo } from 'react';
import type { GuessingChallengePlayerView } from '@wanasatna/shared';
import {
  decideFinalCue,
  decidePublicCorrect,
  decideRoundResult,
  decideTimeUp,
  decideYourTurn,
  localTeamWonMatch,
} from '@/lib/game/sfx-policy';
import { useViewTransitionSfx } from '@/lib/game/use-view-sfx';

const TIMED = new Set(['playing']);

type Snap = {
  phase: GuessingChallengePlayerView['gamePhase'];
  remaining: number;
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
    decideTimeUp({
      prevReady: true,
      prevRemaining: prev.remaining,
      remaining: next.remaining,
      phase: next.phase,
      timedPhases: TIMED,
      eventKey: `timeup:gc:${next.turnId}`,
      suppress: next.hasWinner,
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
  remaining: number,
  guessFeedback: string | null,
): void {
  const snapshot = useMemo<Snap | null>(() => {
    if (!view || !playerId) {
      return null;
    }
    return {
      phase: view.gamePhase,
      remaining,
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
  }, [view, playerId, remaining, guessFeedback]);

  useViewTransitionSfx(snapshot, decide);
}
