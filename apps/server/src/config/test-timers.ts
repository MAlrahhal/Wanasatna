import {
  BARA_AL_SALAFA_GUESS_RESULT_DURATION_SECONDS,
  BARA_AL_SALAFA_IMPOSTOR_GUESS_DURATION_SECONDS,
  BARA_AL_SALAFA_QUESTION_TURN_DURATION_SECONDS,
  BARA_AL_SALAFA_REVEAL_DURATION_SECONDS,
  BARA_AL_SALAFA_ROLE_REVEAL_DURATION_SECONDS,
  BARA_AL_SALAFA_ROUND_RESULTS_DURATION_SECONDS,
  BARA_AL_SALAFA_VOTING_DURATION_SECONDS,
  DEFAULT_GAME_SHELL_COUNTDOWN_SECONDS,
  DEFAULT_GAME_SHELL_LOBBY_WAIT_MS,
  DEFAULT_PLAYER_RECOVERY_SECONDS,
  DRAW_GUESS_DRAW_DURATION_SECONDS,
  DRAW_GUESS_ROUND_RESULTS_DURATION_SECONDS,
  IMPOSTER_DRAW_BRIEFING_SECONDS,
  IMPOSTER_DRAW_GUESS_SECONDS,
  IMPOSTER_DRAW_REVEAL_SECONDS,
  IMPOSTER_DRAW_ROUND_RESULTS_SECONDS,
  IMPOSTER_DRAW_TURN_SECONDS,
  IMPOSTER_DRAW_VOTING_SECONDS,
  FAST_ANSWER_QUESTION_SECONDS,
  FAST_ANSWER_ROUND_RESULTS_SECONDS,
  GUESSING_CHALLENGE_ROUND_RESULTS_SECONDS,
  GUESSING_CHALLENGE_TURN_SECONDS,
  JUDGE_ANSWERING_SECONDS,
  JUDGE_JUDGING_SECONDS,
  JUDGE_ROUND_RESULTS_SECONDS,
  WHO_WROTE_IT_ANSWERING_SECONDS,
  WHO_WROTE_IT_GUESS_SECONDS,
  WHO_WROTE_IT_ROUND_RESULTS_SECONDS,
  MATCH_FINAL_RESULTS_AUTO_LOBBY_SECONDS,
  TIMING_CHALLENGE_GUESS_SECONDS,
  TIMING_CHALLENGE_READY_SECONDS,
  TIMING_CHALLENGE_ROUND_RESULTS_SECONDS,
  TIMING_CHALLENGE_STOP_PHASE_SECONDS,
} from '@wanasatna/shared';
import { env } from './env.js';

const TEST_PHASE_SECONDS = 1;
const TEST_INTERACTIVE_SECONDS = 15;
const TEST_ROUND_RESULTS_SECONDS = 3;
const TEST_LOBBY_WAIT_MS = 50;
const TEST_SHELL_COUNTDOWN_SECONDS = 1;
export const TEST_PLAYER_RECOVERY_SECONDS = 10;

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
      : MATCH_FINAL_RESULTS_AUTO_LOBBY_SECONDS,
  drawGuessDrawing: () =>
    resolveInteractivePhaseSeconds(DRAW_GUESS_DRAW_DURATION_SECONDS),
  drawGuessRoundResults: () =>
    env.testMode
      ? TEST_ROUND_RESULTS_SECONDS
      : DRAW_GUESS_ROUND_RESULTS_DURATION_SECONDS,
  imposterDrawBriefing: () => resolveTimedPhaseSeconds(IMPOSTER_DRAW_BRIEFING_SECONDS),
  imposterDrawTurn: () => resolveTimedPhaseSeconds(IMPOSTER_DRAW_TURN_SECONDS),
  imposterDrawVoting: () => resolveInteractivePhaseSeconds(IMPOSTER_DRAW_VOTING_SECONDS),
  imposterDrawReveal: () => resolveTimedPhaseSeconds(IMPOSTER_DRAW_REVEAL_SECONDS),
  imposterDrawGuess: () => resolveInteractivePhaseSeconds(IMPOSTER_DRAW_GUESS_SECONDS),
  imposterDrawGuessResult: () => resolveTimedPhaseSeconds(BARA_AL_SALAFA_GUESS_RESULT_DURATION_SECONDS),
  imposterDrawRoundResults: () =>
    env.testMode ? TEST_ROUND_RESULTS_SECONDS : IMPOSTER_DRAW_ROUND_RESULTS_SECONDS,
  timingChallengeReady: () => resolveTimedPhaseSeconds(TIMING_CHALLENGE_READY_SECONDS),
  timingChallengeGuess: () => resolveInteractivePhaseSeconds(TIMING_CHALLENGE_GUESS_SECONDS),
  timingChallengeStopPhase: () =>
    resolveInteractivePhaseSeconds(TIMING_CHALLENGE_STOP_PHASE_SECONDS),
  timingChallengeRoundResults: () =>
    env.testMode ? TEST_ROUND_RESULTS_SECONDS : TIMING_CHALLENGE_ROUND_RESULTS_SECONDS,
  fastAnswerQuestion: () => resolveInteractivePhaseSeconds(FAST_ANSWER_QUESTION_SECONDS),
  fastAnswerRoundResults: () =>
    env.testMode ? TEST_ROUND_RESULTS_SECONDS : FAST_ANSWER_ROUND_RESULTS_SECONDS,
  whoWroteItAnswering: () => resolveInteractivePhaseSeconds(WHO_WROTE_IT_ANSWERING_SECONDS),
  whoWroteItGuess: () => resolveInteractivePhaseSeconds(WHO_WROTE_IT_GUESS_SECONDS),
  whoWroteItRoundResults: () =>
    env.testMode ? TEST_ROUND_RESULTS_SECONDS : WHO_WROTE_IT_ROUND_RESULTS_SECONDS,
  judgeAnswering: () => resolveInteractivePhaseSeconds(JUDGE_ANSWERING_SECONDS),
  judgeJudging: () => resolveInteractivePhaseSeconds(JUDGE_JUDGING_SECONDS),
  judgeRoundResults: () =>
    env.testMode ? TEST_ROUND_RESULTS_SECONDS : JUDGE_ROUND_RESULTS_SECONDS,
  guessingChallengeTurn: () =>
    resolveInteractivePhaseSeconds(GUESSING_CHALLENGE_TURN_SECONDS),
  guessingChallengeRoundResults: () =>
    env.testMode ? TEST_ROUND_RESULTS_SECONDS : GUESSING_CHALLENGE_ROUND_RESULTS_SECONDS,
  shellCountdown: () => resolveShellCountdownSeconds(DEFAULT_GAME_SHELL_COUNTDOWN_SECONDS),
};
