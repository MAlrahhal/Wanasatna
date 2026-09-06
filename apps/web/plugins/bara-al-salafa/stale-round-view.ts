type BaraRoundIdentity = {
  currentRound: number;
  gamePhase: string;
};

/**
 * After the client knows round-results for `fromRound` has ended, the previous
 * round's secret role must not be treated as the current round's role.
 */
export function isStaleBaraRoleView(
  awaitingFromRound: number | null,
  view: BaraRoundIdentity | null,
): boolean {
  if (awaitingFromRound === null) {
    return false;
  }

  if (!view) {
    return true;
  }

  if (view.currentRound > awaitingFromRound) {
    return false;
  }

  return view.gamePhase !== 'match-completed';
}
