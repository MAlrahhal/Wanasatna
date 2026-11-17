import type { SameWavelengthPlayerView, SameWavelengthPhase } from '@wanasatna/shared';

const PHASE_ORDER: Record<SameWavelengthPhase, number> = {
  'clue-writing': 0,
  guessing: 1,
  'turn-results': 2,
  completed: 3,
};

function turnSequence(view: SameWavelengthPlayerView): number {
  return view.currentRound * 10 + (view.teamTurnNumber ?? 1);
}

/** Rejects snapshots that would move the same match back in time or extend a phase. */
export function shouldAcceptSameWavelengthView(
  current: SameWavelengthPlayerView | null,
  incoming: SameWavelengthPlayerView,
): boolean {
  if (!current || current.matchId !== incoming.matchId) return true;

  const currentTurn = turnSequence(current);
  const incomingTurn = turnSequence(incoming);
  if (incomingTurn !== currentTurn) return incomingTurn > currentTurn;
  if (current.turnId !== incoming.turnId) return false;

  const currentPhase = PHASE_ORDER[current.phase];
  const incomingPhase = PHASE_ORDER[incoming.phase];
  if (incomingPhase !== currentPhase) return incomingPhase > currentPhase;

  if (
    current.deadlineAtMs !== null &&
    incoming.deadlineAtMs !== null &&
    current.deadlineAtMs !== incoming.deadlineAtMs
  ) {
    return false;
  }
  if (current.mode === 'individual' && current.ownConfirmed && !incoming.ownConfirmed) {
    return false;
  }
  return true;
}
