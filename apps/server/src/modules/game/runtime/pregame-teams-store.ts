import type {
  PregameTeamSnapshot,
  TeamId,
  TeamMemberAssignment,
  TeamSeat,
} from '@wanasatna/shared';

export type PregameTeamState = {
  roomId: string;
  gameId: string;
  mode: string;
  capacityPerTeam: number;
  /** Seat-ordered player ids per team. */
  blue: string[];
  red: string[];
  manuallyEdited: boolean;
};

const teamsByRoomId = new Map<string, PregameTeamState>();

export function getPregameTeams(roomId: string): PregameTeamState | null {
  return teamsByRoomId.get(roomId) ?? null;
}

export function setPregameTeams(roomId: string, state: PregameTeamState): void {
  teamsByRoomId.set(roomId, state);
}

export function clearPregameTeams(roomId: string): void {
  teamsByRoomId.delete(roomId);
}

export function toTeamMaps(state: PregameTeamState): {
  teamByPlayerId: Record<string, TeamId>;
  seatByPlayerId: Record<string, TeamSeat>;
} {
  const teamByPlayerId: Record<string, TeamId> = {};
  const seatByPlayerId: Record<string, TeamSeat> = {};

  state.blue.forEach((playerId, index) => {
    teamByPlayerId[playerId] = 'blue';
    seatByPlayerId[playerId] = (index === 0 ? 0 : 1) as TeamSeat;
  });
  state.red.forEach((playerId, index) => {
    teamByPlayerId[playerId] = 'red';
    seatByPlayerId[playerId] = (index === 0 ? 0 : 1) as TeamSeat;
  });

  return { teamByPlayerId, seatByPlayerId };
}

export function toPregameTeamSnapshot(
  state: PregameTeamState,
  eligiblePlayerIds: readonly string[],
): PregameTeamSnapshot {
  const assigned = new Set([...state.blue, ...state.red]);
  const assignments: TeamMemberAssignment[] = [
    ...state.blue.map((playerId, index) => ({
      playerId,
      teamId: 'blue' as const,
      seat: (index === 0 ? 0 : 1) as TeamSeat,
    })),
    ...state.red.map((playerId, index) => ({
      playerId,
      teamId: 'red' as const,
      seat: (index === 0 ? 0 : 1) as TeamSeat,
    })),
  ];

  return {
    roomId: state.roomId,
    gameId: state.gameId,
    mode: state.mode,
    capacityPerTeam: state.capacityPerTeam,
    assignments,
    unassignedPlayerIds: eligiblePlayerIds.filter((id) => !assigned.has(id)),
    manuallyEdited: state.manuallyEdited,
  };
}
