export type GameShellPlayer = {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
  isReady: boolean;
  /** Room-seat spectator for the current live match. Omitted/false = participant-eligible. */
  isSpectator?: boolean;
};
