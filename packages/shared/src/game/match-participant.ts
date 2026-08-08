import type { GameShellState } from './state.js';

export function isActiveShellPhase(phase: GameShellState['phase']): boolean {
  return phase === 'COUNTDOWN' || phase === 'PLAYING';
}

export function isActiveMatchParticipant(
  shell: GameShellState | null | undefined,
  playerId: string,
): boolean {
  if (!shell || !isActiveShellPhase(shell.phase)) {
    return false;
  }

  if (shell.matchParticipantIds) {
    return shell.matchParticipantIds.includes(playerId);
  }

  return shell.players.some((player) => player.id === playerId);
}

export function isWaitingForNextMatch(
  shell: GameShellState | null | undefined,
  playerId: string,
): boolean {
  if (!shell || !isActiveShellPhase(shell.phase)) {
    return false;
  }

  return !isActiveMatchParticipant(shell, playerId);
}
