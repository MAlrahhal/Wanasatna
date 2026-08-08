import type { BaraAlSalafaMatchState, GameShellState } from '@wanasatna/shared';
import { getConnectedParticipantIds } from './free-questions.js';

export function haveAllConnectedParticipantsAcknowledgedRole(
  shell: GameShellState,
  match: BaraAlSalafaMatchState,
): boolean {
  const connectedIds = getConnectedParticipantIds(shell, match);

  if (connectedIds.length === 0) {
    return false;
  }

  const acknowledgedIds = new Set(match.round.roleUnderstoodPlayerIds);

  return connectedIds.every((playerId) => acknowledgedIds.has(playerId));
}

export function applyRoleUnderstood(
  match: BaraAlSalafaMatchState,
  playerId: string,
): BaraAlSalafaMatchState {
  if (match.round.roleUnderstoodPlayerIds.includes(playerId)) {
    return match;
  }

  return {
    ...match,
    round: {
      ...match.round,
      roleUnderstoodPlayerIds: [...match.round.roleUnderstoodPlayerIds, playerId],
    },
  };
}
