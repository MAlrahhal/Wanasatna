/** Stable team ids — never use Arabic labels as identifiers. */
export type TeamId = 'blue' | 'red';

export type TeamSeat = 0 | 1;

export type TeamMemberAssignment = {
  playerId: string;
  teamId: TeamId;
  seat: TeamSeat;
};

/**
 * Opt-in team capability declared by a game plugin / shared catalog.
 * Non-team games omit this entirely.
 */
export type GameTeamCapability = {
  enabled: true;
  teamIds: readonly TeamId[];
  /** Max players per team keyed by lobby mode (e.g. 1v1 → 1, 2v2 → 2). */
  capacityByMode: Readonly<Record<string, number>>;
  defaultMode: string;
};

/** Authoritative pre-match team snapshot broadcast to all room clients. */
export type PregameTeamSnapshot = {
  roomId: string;
  gameId: string;
  mode: string;
  capacityPerTeam: number;
  assignments: TeamMemberAssignment[];
  /** Player ids in the room that are eligible but not on a team. */
  unassignedPlayerIds: string[];
  manuallyEdited: boolean;
};

export type TeamAssignPayload = {
  playerId: string;
  teamId: TeamId;
};

export type TeamConfigurePayload = {
  gameId: string;
  mode: string;
};
