import {
  BARA_AL_SALAFA_GUESS_RESULT_DURATION_SECONDS,
  BARA_AL_SALAFA_IMPOSTOR_GUESS_DURATION_SECONDS,
  BARA_AL_SALAFA_MATCH_RESULTS_DURATION_SECONDS,
  BARA_AL_SALAFA_QUESTION_TURN_DURATION_SECONDS,
  BARA_AL_SALAFA_REVEAL_DURATION_SECONDS,
  BARA_AL_SALAFA_ROLE_REVEAL_DURATION_SECONDS,
  BARA_AL_SALAFA_ROUND_RESULTS_DURATION_SECONDS,
  BARA_AL_SALAFA_VOTING_DURATION_SECONDS,
  DEFAULT_GAME_SHELL_COUNTDOWN_SECONDS,
  DEFAULT_GAME_SHELL_LOBBY_WAIT_MS,
  DEFAULT_PLAYER_RECOVERY_SECONDS,
} from '@wanasatna/shared';
import { env } from './env.js';

const TEST_PHASE_SECONDS = 1;
const TEST_INTERACTIVE_SECONDS = 15;
const TEST_ROUND_RESULTS_SECONDS = 3;
const TEST_LOBBY_WAIT_MS = 50;
const TEST_SHELL_COUNTDOWN_SECONDS = 1;
const TEST_PLAYER_RECOVERY_SECONDS = 10;

/** Returns production or 1-second test duration. Production constants stay unchanged. */
export function resolveTimedPhaseSeconds(productionSeconds: number): number {
  return env.testMode ? TEST_PHASE_SECONDS : productionSeconds;
}

function resolveInteractivePhaseSeconds(productionSeconds: number): number {
  return env.testMode ? TEST_INTERACTIVE_SECONDS : productionSeconds;
}

export function resolveLobbyWaitMs(): number {
  return env.testMode ? TEST_LOBBY_WAIT_MS : DEFAULT_GAME_SHELL_LOBBY_WAIT_MS;
}

export function resolveShellCountdownSeconds(productionSeconds: number): number {
  return env.testMode ? TEST_SHELL_COUNTDOWN_SECONDS : productionSeconds;
}

export function resolveDescriptionDurationSeconds(
  _settingsRoundTime?: number | undefined,
): number {
  return resolveTimedPhaseSeconds(BARA_AL_SALAFA_ROLE_REVEAL_DURATION_SECONDS);
}

export function resolveQuestionTurnDurationSeconds(
  _scaledSeconds?: number,
): number {
  return resolveInteractivePhaseSeconds(BARA_AL_SALAFA_QUESTION_TURN_DURATION_SECONDS);
}

export function resolveMatchRounds(settingsRounds: number | undefined, defaultRounds: number): number {
  const production = settingsRounds ?? defaultRounds;
  return env.testMode ? 1 : production;
}

export function resolvePlayerRecoverySeconds(): number {
  return env.testMode ? TEST_PLAYER_RECOVERY_SECONDS : DEFAULT_PLAYER_RECOVERY_SECONDS;
}

export const timedPhaseDurations = {
  roleReveal: () => resolveTimedPhaseSeconds(BARA_AL_SALAFA_ROLE_REVEAL_DURATION_SECONDS),
  questionTurn: () => resolveInteractivePhaseSeconds(BARA_AL_SALAFA_QUESTION_TURN_DURATION_SECONDS),
  voting: () => resolveInteractivePhaseSeconds(BARA_AL_SALAFA_VOTING_DURATION_SECONDS),
  reveal: () => resolveTimedPhaseSeconds(BARA_AL_SALAFA_REVEAL_DURATION_SECONDS),
  impostorGuess: () => resolveInteractivePhaseSeconds(BARA_AL_SALAFA_IMPOSTOR_GUESS_DURATION_SECONDS),
  guessResult: () => resolveTimedPhaseSeconds(BARA_AL_SALAFA_GUESS_RESULT_DURATION_SECONDS),
  roundResults: () =>
    env.testMode
      ? TEST_ROUND_RESULTS_SECONDS
      : BARA_AL_SALAFA_ROUND_RESULTS_DURATION_SECONDS,
  matchResults: () =>
    env.testMode
      ? TEST_ROUND_RESULTS_SECONDS
      : BARA_AL_SALAFA_MATCH_RESULTS_DURATION_SECONDS,
  shellCountdown: () => resolveShellCountdownSeconds(DEFAULT_GAME_SHELL_COUNTDOWN_SECONDS),
};
