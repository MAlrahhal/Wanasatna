import type { GameShellState, ImposterDrawMatchState } from '@wanasatna/shared';

export function getConnectedParticipantIds(
  shell: GameShellState,
  match: ImposterDrawMatchState,
): string[] {
  const participantIds = new Set(match.playerIds);

  return shell.players
    .filter((player) => player.isConnected && participantIds.has(player.id))
    .map((player) => player.id);
}

export function haveAllConnectedParticipantsVoted(
  shell: GameShellState,
  match: ImposterDrawMatchState,
): boolean {
  const connectedIds = getConnectedParticipantIds(shell, match);

  if (connectedIds.length === 0) {
    return false;
  }

  const submittedIds = new Set(match.round.submittedVoterIds);
  return connectedIds.every((playerId) => submittedIds.has(playerId));
}

export function applyVote(
  match: ImposterDrawMatchState,
  voterId: string,
  targetPlayerId: string,
): ImposterDrawMatchState {
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

export function resolveImpostorVotedOut(match: ImposterDrawMatchState): boolean {
  const voteCounts = new Map<string, number>();

  for (const targetPlayerId of Object.values(match.round.votes)) {
    voteCounts.set(targetPlayerId, (voteCounts.get(targetPlayerId) ?? 0) + 1);
  }

  if (voteCounts.size === 0) {
    return false;
  }

  let topCount = 0;
  for (const count of voteCounts.values()) {
    topCount = Math.max(topCount, count);
  }

  const leaders = [...voteCounts.entries()]
    .filter(([, count]) => count === topCount)
    .map(([playerId]) => playerId);

  return leaders.length === 1 && leaders[0] === match.round.impostorPlayerId;
}

export function buildVoteTally(
  match: ImposterDrawMatchState,
): Array<{ playerId: string; name: string; voteCount: number }> {
  const voteCounts = new Map<string, number>();

  for (const playerId of match.playerIds) {
    voteCounts.set(playerId, 0);
  }

  for (const targetPlayerId of Object.values(match.round.votes)) {
    voteCounts.set(targetPlayerId, (voteCounts.get(targetPlayerId) ?? 0) + 1);
  }

  return match.playerIds
    .map((playerId) => ({
      playerId,
      name: match.playerNames[playerId] ?? 'لاعب',
      voteCount: voteCounts.get(playerId) ?? 0,
    }))
    .sort((left, right) => right.voteCount - left.voteCount);
}
