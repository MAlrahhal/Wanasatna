import { pluginActionEvent, pluginStateEvent } from '../../plugin/events.js';

export const TIMING_CHALLENGE_GAME_ID = 'timing-challenge' as const;

export const TIMING_CHALLENGE_DEFAULT_ROUNDS = 3;
export const TIMING_CHALLENGE_DEFAULT_MIN_SECONDS = 3;
export const TIMING_CHALLENGE_DEFAULT_MAX_SECONDS = 15;
export const TIMING_CHALLENGE_ABSOLUTE_MIN_SECONDS = 1;
export const TIMING_CHALLENGE_ABSOLUTE_MAX_SECONDS = 60;

export type TimingChallengeMode = 'guess-time' | 'stop-timer';

export type TimingChallengeGamePhase =
  | 'ready'
  | 'hidden-timing'
  | 'guessing'
  | 'stop-timer'
  | 'round-results'
  | 'match-completed';

export type TimingChallengeSettings = {
  mode: TimingChallengeMode;
  rounds: number;
  minSeconds: number;
  maxSeconds: number;
};

export type TimingChallengePlayerRoundState = {
  ready: boolean;
  guessMs: number | null;
  timerStartedAtMs: number | null;
  stoppedAtMs: number | null;
  elapsedMs: number | null;
  errorMs: number | null;
  signedDeltaMs: number | null;
};

export type TimingChallengeRoundState = {
  gamePhase: TimingChallengeGamePhase;
  phaseRemainingSeconds: number;
  /** Authoritative target / hidden duration. Never leak before reveal. */
  targetMs: number;
  /** Mode A: when the hidden timer started (Date.now). */
  hiddenStartedAtMs: number | null;
  /** Mode A: when the hidden timer ends. */
  hiddenEndsAtMs: number | null;
  playerStates: Record<string, TimingChallengePlayerRoundState>;
};

export type TimingChallengeMatchState = {
  playerIds: string[];
  playerNames: Record<string, string>;
  currentRound: number;
  totalRounds: number;
  scores: Record<string, number>;
  matchStatus: 'in-progress' | 'completed';
  settings: TimingChallengeSettings;
  round: TimingChallengeRoundState;
};

export type TimingChallengeLeaderboardEntry = {
  playerId: string;
  name: string;
  score: number;
};

export type TimingChallengeRoundResultEntry = {
  playerId: string;
  name: string;
  elapsedMs: number | null;
  guessMs: number | null;
  errorMs: number | null;
  signedDeltaMs: number | null;
  roundPoints: number;
  totalPoints: number;
  placement: number;
  isTied: boolean;
};

export type TimingChallengePeerStatus = {
  playerId: string;
  name: string;
  status: 'waiting' | 'ready' | 'running' | 'done';
};

export type TimingChallengePlayerView = {
  gamePhase: TimingChallengeGamePhase;
  phaseLabel: string;
  phaseRemainingSeconds: number;
  mode: TimingChallengeMode;
  currentRound: number;
  totalRounds: number;
  matchStatus: 'in-progress' | 'completed';
  /** Public in Mode B always; Mode A only after reveal. */
  targetMs: number | null;
  selfReady: boolean;
  selfGuessMs: number | null;
  selfSubmitted: boolean;
  selfTimerRunning: boolean;
  selfElapsedMs: number | null;
  selfErrorMs: number | null;
  selfSignedDeltaMs: number | null;
  canReady: boolean;
  canGuess: boolean;
  canStartTimer: boolean;
  canStopTimer: boolean;
  peers: TimingChallengePeerStatus[];
  roundResults: TimingChallengeRoundResultEntry[];
  leaderboard: TimingChallengeLeaderboardEntry[];
  resultsLeaderboard: Array<{
    playerId: string;
    name: string;
    totalPoints: number;
    rank: number;
    isFirstPlace: boolean;
  }>;
  isHost: boolean;
  canContinueFromRoundResults: boolean;
  roundResultsContinueLabel: string | null;
  roundResultsWaitingMessage: string | null;
};

export const TIMING_CHALLENGE_SYNC_EVENT = pluginActionEvent(
  TIMING_CHALLENGE_GAME_ID,
  'sync',
);
export const TIMING_CHALLENGE_PHASE_CHANGED_EVENT = pluginActionEvent(
  TIMING_CHALLENGE_GAME_ID,
  'phase-changed',
);
export const TIMING_CHALLENGE_READY_EVENT = pluginActionEvent(
  TIMING_CHALLENGE_GAME_ID,
  'ready',
);
export const TIMING_CHALLENGE_SUBMIT_GUESS_EVENT = pluginActionEvent(
  TIMING_CHALLENGE_GAME_ID,
  'submit-guess',
);
export const TIMING_CHALLENGE_START_TIMER_EVENT = pluginActionEvent(
  TIMING_CHALLENGE_GAME_ID,
  'start-timer',
);
export const TIMING_CHALLENGE_STOP_TIMER_EVENT = pluginActionEvent(
  TIMING_CHALLENGE_GAME_ID,
  'stop-timer',
);
export const TIMING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT = pluginActionEvent(
  TIMING_CHALLENGE_GAME_ID,
  'continue-round-results',
);
export const TIMING_CHALLENGE_STATE_EVENT = pluginStateEvent(TIMING_CHALLENGE_GAME_ID);

export type TimingChallengeSubmitGuessPayload = {
  guessSeconds: number;
};
