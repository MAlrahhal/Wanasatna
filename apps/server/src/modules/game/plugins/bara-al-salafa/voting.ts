import type { BaraAlSalafaMatchState, GameShellState } from '@wanasatna/shared';
import { isActiveMatchParticipant } from '@wanasatna/shared';

export function isEligibleBaraVoter(
  shell: GameShellState,
  match: BaraAlSalafaMatchState,
  playerId: string,
): boolean {
  if (!isActiveMatchParticipant(shell, playerId)) {
    return false;
  }

  const player = shell.players.find((entry) => entry.id === playerId);
  if (!player || !player.isConnected || player.isSpectator) {
    return false;
  }

  return match.playerIds.includes(playerId);
}

export function getConnectedParticipantIds(
  shell: GameShellState,
  match: BaraAlSalafaMatchState,
): string[] {
  const participantIds = new Set(match.playerIds);

  return shell.players
    .filter((player) => player.isConnected && participantIds.has(player.id))
    .map((player) => player.id);
}

export function haveAllConnectedParticipantsVoted(
  shell: GameShellState,
  match: BaraAlSalafaMatchState,
): boolean {
  const connectedIds = getConnectedParticipantIds(shell, match);

  if (connectedIds.length === 0) {
    return false;
  }

  const submittedIds = new Set(match.round.submittedVoterIds);

  return connectedIds.every((playerId) => submittedIds.has(playerId));
}

export function applyVote(
  match: BaraAlSalafaMatchState,
  voterId: string,
  targetPlayerId: string,
): BaraAlSalafaMatchState {
  return {
    ...match,
    round: {
      ...match.round,
      votes: {
        ...match.round.votes,
        [voterId]: targetPlayerId,
      },
      submittedVoterIds: match.round.submittedVoterIds.includes(voterId)
        ? match.round.submittedVoterIds
        : [...match.round.submittedVoterIds, voterId],
    },
  };
}
