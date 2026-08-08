import type { BaraAlSalafaMatchState, GameShellState } from '@wanasatna/shared';

export function getConnectedParticipantIds(
  shell: GameShellState,
  match: BaraAlSalafaMatchState,
): string[] {
  const participantIds = new Set(match.playerIds);

  return shell.players
    .filter((player) => player.isConnected && participantIds.has(player.id))
    .map((player) => player.id);
}

export function getRemainingFreeQuestionPlayerIds(
  shell: GameShellState,
  match: BaraAlSalafaMatchState,
): string[] {
  const completedIds = new Set(match.round.completedFreeQuestionTurns);

  return getConnectedParticipantIds(shell, match).filter(
    (playerId) => !completedIds.has(playerId),
  );
}

export function pickRandomPlayerId(playerIds: string[]): string | null {
  if (playerIds.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * playerIds.length);
  return playerIds[index] ?? null;
}

export function isFreeQuestionsPhaseComplete(
  shell: GameShellState,
  match: BaraAlSalafaMatchState,
): boolean {
  const connectedIds = getConnectedParticipantIds(shell, match);

  if (connectedIds.length === 0) {
    return false;
  }

  const completedIds = new Set(match.round.completedFreeQuestionTurns);

  return connectedIds.every((playerId) => completedIds.has(playerId));
}

export function completeActiveFreeQuestionTurn(
  match: BaraAlSalafaMatchState,
  activePlayerId: string,
): BaraAlSalafaMatchState {
  if (match.round.completedFreeQuestionTurns.includes(activePlayerId)) {
    return match;
  }

  return {
    ...match,
    round: {
      ...match.round,
      completedFreeQuestionTurns: [...match.round.completedFreeQuestionTurns, activePlayerId],
    },
  };
}
