import type { GameSettingValues } from './admin-settings.js';

export const MARATHON_SUPPORTED_GAME_IDS = [
  'bara-al-salafa',
  'draw-guess',
  'imposter-draw',
  'timing-challenge',
  'fast-answer',
  'who-wrote-it',
  'judge',
] as const;

export type MarathonGameId = (typeof MARATHON_SUPPORTED_GAME_IDS)[number];
export const MARATHON_MIN_GAMES = 2;
export const MARATHON_MAX_GAMES = 7;
export const MARATHON_TRANSITION_SECONDS = 10;
export const MARATHON_FINAL_RESULTS_SECONDS = 15;

export type MarathonGameConfiguration = {
  categoryId: string | null;
  settings: GameSettingValues;
  timingChallenge?: {
    mode: 'guess-time' | 'stop-timer';
    minSeconds: number;
    maxSeconds: number;
  };
  drawGuess?: {
    drawerMode: 'random' | 'fixed';
    fixedPlayerId?: string;
  };
};

export type MarathonGamePlanItem = {
  gameId: MarathonGameId;
  configuration: MarathonGameConfiguration;
};

export type MarathonScoreEntry = {
  playerId: string;
  playerName: string;
  totalPoints: number;
  rank: number;
};

export type MarathonCompletedGame = {
  gameIndex: number;
  gameId: MarathonGameId;
  shellId: string;
  scores: Array<{
    playerId: string;
    rawScore: number;
    marathonPoints: number;
  }>;
};

export type MarathonSkippedGame = {
  gameIndex: number;
  gameId: MarathonGameId;
  reason: string;
};

export type MarathonTransition = {
  gameIndex: number;
  gameId: MarathonGameId;
  kind: 'completed' | 'host-ended' | 'skipped';
  reason: string | null;
};

export type MarathonStatus = 'PREPARING' | 'PLAYING' | 'TRANSITION' | 'FINISHED';

export type MarathonState = {
  marathonId: string;
  roomId: string;
  revision: number;
  status: MarathonStatus;
  gamePlan: MarathonGamePlanItem[];
  currentGameIndex: number;
  activeShellId: string | null;
  participantIds: string[];
  playerNames: Record<string, string>;
  playerTotals: Record<string, number>;
  departedPlayerIds: string[];
  completedGames: MarathonCompletedGame[];
  skippedGames: MarathonSkippedGame[];
  lastTransition: MarathonTransition | null;
  finishReason: 'completed' | 'host-ended' | null;
  transitionDeadlineAtMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  timerGeneration: number;
  leaderboard: MarathonScoreEntry[];
};

export type StartMarathonPayload = { gamePlan: MarathonGamePlanItem[] };
export type ContinueMarathonPayload = {
  marathonId: string;
  currentGameIndex: number;
  activeShellId: string | null;
};

export const MARATHON_PREPARE_EVENT = 'marathon-prepare' as const;
export const MARATHON_START_EVENT = 'marathon-start' as const;
export const MARATHON_SYNC_EVENT = 'marathon-sync' as const;
export const MARATHON_CONTINUE_EVENT = 'marathon-continue' as const;
export const MARATHON_RETURN_TO_LOBBY_EVENT = 'marathon-return-to-lobby' as const;
export const MARATHON_END_EVENT = 'marathon-end' as const;
export const MARATHON_STATE_EVENT = 'marathon-state' as const;

export function isMarathonGameId(value: string): value is MarathonGameId {
  return (MARATHON_SUPPORTED_GAME_IDS as readonly string[]).includes(value);
}

export function normalizeMarathonScores(
  rawScores: ReadonlyArray<{ playerId: string; score: number }>,
): Array<{ playerId: string; rawScore: number; marathonPoints: number }> {
  const highestRawScore = Math.max(0, ...rawScores.map((entry) => entry.score));
  return rawScores.map((entry) => ({
    playerId: entry.playerId,
    rawScore: entry.score,
    marathonPoints:
      highestRawScore === 0
        ? 0
        : Math.round((100 * Math.max(0, entry.score) * 100) / highestRawScore) / 100,
  }));
}

export function accumulateMarathonPoints(
  current: Readonly<Record<string, number>>,
  awarded: ReadonlyArray<{ playerId: string; marathonPoints: number }>,
): Record<string, number> {
  const totals = { ...current };
  for (const entry of awarded) {
    totals[entry.playerId] =
      Math.round(((totals[entry.playerId] ?? 0) + entry.marathonPoints) * 100) / 100;
  }
  return totals;
}
