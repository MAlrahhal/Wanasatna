import type { TimingChallengeMode, TimingChallengeSettings } from '@wanasatna/shared';
import {
  TIMING_CHALLENGE_ABSOLUTE_MAX_SECONDS,
  TIMING_CHALLENGE_ABSOLUTE_MIN_SECONDS,
  TIMING_CHALLENGE_DEFAULT_MAX_SECONDS,
  TIMING_CHALLENGE_DEFAULT_MIN_SECONDS,
  TIMING_CHALLENGE_DEFAULT_ROUNDS,
} from '@wanasatna/shared';

export function defaultTimingChallengeSettings(): TimingChallengeSettings {
  return {
    mode: 'guess-time',
    rounds: TIMING_CHALLENGE_DEFAULT_ROUNDS,
    minSeconds: TIMING_CHALLENGE_DEFAULT_MIN_SECONDS,
    maxSeconds: TIMING_CHALLENGE_DEFAULT_MAX_SECONDS,
  };
}

export function normalizeTimingChallengeSettings(
  input: Partial<TimingChallengeSettings> | null | undefined,
): TimingChallengeSettings | { error: string } {
  const defaults = defaultTimingChallengeSettings();
  const mode = (input?.mode ?? defaults.mode) as TimingChallengeMode;

  if (mode !== 'guess-time' && mode !== 'stop-timer') {
    return { error: 'وضع اللعب غير صالح.' };
  }

  const rounds = Math.round(Number(input?.rounds ?? defaults.rounds));
  const minSeconds = Number(input?.minSeconds ?? defaults.minSeconds);
  const maxSeconds = Number(input?.maxSeconds ?? defaults.maxSeconds);

  if (!Number.isFinite(rounds) || rounds < 1 || rounds > 10) {
    return { error: 'عدد الجولات يجب أن يكون بين 1 و 10.' };
  }

  if (
    !Number.isFinite(minSeconds) ||
    !Number.isFinite(maxSeconds) ||
    minSeconds < TIMING_CHALLENGE_ABSOLUTE_MIN_SECONDS ||
    maxSeconds > TIMING_CHALLENGE_ABSOLUTE_MAX_SECONDS ||
    minSeconds >= maxSeconds
  ) {
    return {
      error: `نطاق الوقت يجب أن يكون بين ${TIMING_CHALLENGE_ABSOLUTE_MIN_SECONDS} و ${TIMING_CHALLENGE_ABSOLUTE_MAX_SECONDS} ثانية، والحد الأدنى أقل من الحد الأقصى.`,
    };
  }

  return {
    mode,
    rounds,
    minSeconds: Math.round(minSeconds * 100) / 100,
    maxSeconds: Math.round(maxSeconds * 100) / 100,
  };
}

export function pickTargetMs(settings: TimingChallengeSettings): number {
  const minMs = Math.round(settings.minSeconds * 1000);
  const maxMs = Math.round(settings.maxSeconds * 1000);
  const span = Math.max(0, maxMs - minMs);
  // Hundredths precision for Mode B feel; Mode A also fine.
  const steps = Math.floor(span / 10);
  const offsetSteps = steps <= 0 ? 0 : Math.floor(Math.random() * (steps + 1));
  return minMs + offsetSteps * 10;
}
