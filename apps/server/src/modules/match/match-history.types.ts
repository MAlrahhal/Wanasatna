export type MatchParticipantResult = {
  playerId: string;
  score?: number | null;
  rank?: number | null;
  team?: string | null;
  isWinner?: boolean | null;
};

export type BeginPersistedMatchInput = {
  roomId: string;
  gameId: string;
  participantPlayerIds: string[];
  displayNameByPlayerId?: Record<string, string>;
};
