import {
  BARA_AL_SALAFA_IMPOSTOR_GUESS_DURATION_SECONDS,
  BARA_AL_SALAFA_MATCH_RESULTS_DURATION_SECONDS,
  BARA_AL_SALAFA_ROUND_RESULTS_DURATION_SECONDS,
  BARA_AL_SALAFA_REVEAL_DURATION_SECONDS,
  BARA_AL_SALAFA_VOTING_DURATION_SECONDS,
  DEFAULT_GAME_SHELL_COUNTDOWN_SECONDS,
  DEFAULT_GAME_SHELL_LOBBY_WAIT_MS,
  DEFAULT_PLAYER_RECOVERY_SECONDS,
} from '@wanasatna/shared';
import { env } from './env.js';

const TEST_PHASE_SECONDS = 1;
const TEST_LOBBY_WAIT_MS = 50;
const TEST_SHELL_COUNTDOWN_SECONDS = 1;
const TEST_PLAYER_RECOVERY_SECONDS = 2;

/** Returns production or 1-second test duration. Production constants stay unchanged. */
export function resolveTimedPhaseSeconds(productionSeconds: number): number {
  return env.testMode ? TEST_PHASE_SECONDS : productionSeconds;
}

export function resolveLobbyWaitMs(): number {
  return env.testMode ? TEST_LOBBY_WAIT_MS : DEFAULT_GAME_SHELL_LOBBY_WAIT_MS;
}

export function resolveShellCountdownSeconds(productionSeconds: number): number {
  return env.testMode ? TEST_SHELL_COUNTDOWN_SECONDS : productionSeconds;
}

export function resolveDescriptionDurationSeconds(settingsRoundTime: number | undefined): number {
  const production = settingsRoundTime ?? 60;
  return env.testMode ? TEST_PHASE_SECONDS : production;
}

export function resolveQuestionTurnDurationSeconds(scaledSeconds: number): number {
  return env.testMode ? TEST_PHASE_SECONDS : scaledSeconds;
}

export function resolveMatchRounds(settingsRounds: number | undefined, defaultRounds: number): number {
  const production = settingsRounds ?? defaultRounds;
  return env.testMode ? 1 : production;
}

export function resolvePlayerRecoverySeconds(): number {
  return env.testMode ? TEST_PLAYER_RECOVERY_SECONDS : DEFAULT_PLAYER_RECOVERY_SECONDS;
}

export const timedPhaseDurations = {
  voting: () => resolveTimedPhaseSeconds(BARA_AL_SALAFA_VOTING_DURATION_SECONDS),
  reveal: () => resolveTimedPhaseSeconds(BARA_AL_SALAFA_REVEAL_DURATION_SECONDS),
  impostorGuess: () => resolveTimedPhaseSeconds(BARA_AL_SALAFA_IMPOSTOR_GUESS_DURATION_SECONDS),
  roundResults: () => resolveTimedPhaseSeconds(BARA_AL_SALAFA_ROUND_RESULTS_DURATION_SECONDS),
  matchResults: () => resolveTimedPhaseSeconds(BARA_AL_SALAFA_MATCH_RESULTS_DURATION_SECONDS),
  shellCountdown: () => resolveShellCountdownSeconds(DEFAULT_GAME_SHELL_COUNTDOWN_SECONDS),
};
