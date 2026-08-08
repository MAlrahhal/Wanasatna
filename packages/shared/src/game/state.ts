import type { GamePhase } from './enums.js';
import type { GameShellPlayer } from './player.js';

export type GameShellState = {
  shellId: string;
  roomId: string;
  gameId: string | null;
  phase: GamePhase;
  hostPlayerId: string;
  players: GameShellPlayer[];
  readyPlayerIds: string[];
  countdownSeconds: number | null;
  countdownRemainingSeconds: number | null;
  gameTimerSeconds: number | null;
  gameTimerRemainingSeconds: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  /** Locked when countdown starts; only these players participate in the current match. */
  matchParticipantIds: string[] | null;
};
