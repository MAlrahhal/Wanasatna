import type { ReactNode } from 'react';

/** UI-safe leaderboard row for the shared live-game shell. */
export type GameLeaderboardEntry = {
  playerId: string;
  name: string;
  rank?: number;
  score: number;
  isCurrentPlayer: boolean;
  scoreDelta?: number;
};

export type GameExperienceTimer = {
  deadlineAtMs: number;
  format?: 'mm:ss' | 'seconds';
  lowTimeThreshold?: number;
};

export type GameExperienceMeta = {
  gameName: string;
  gameIcon?: ReactNode;
  phaseLabel?: string;
  /** Optional public category label, e.g. "الفئة: أكلات". */
  categoryLabel?: string;
  /** Optional top-center identity label, e.g. "القاضي: محمد". */
  centerLabel?: string;
  currentRound?: number;
  totalRounds?: number;
  timer?: GameExperienceTimer;
  leaderboardEntries?: GameLeaderboardEntry[] | null;
};
