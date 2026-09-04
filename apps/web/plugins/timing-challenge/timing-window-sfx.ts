import type { TimingChallengePlayerView } from '@wanasatna/shared';

export type TimingWindowSfxSnapshot = {
  round: number;
  phase: TimingChallengePlayerView['gamePhase'];
  running: boolean;
  mode: TimingChallengePlayerView['mode'];
};

/**
 * True only on the client transition into a running timing window.
 * Remount / reconnect (`prev == null`) does not count.
 */
export function shouldPlayTimingStartSound(
  prev: TimingWindowSfxSnapshot | null,
  next: TimingWindowSfxSnapshot,
): boolean {
  if (!prev) {
    return false;
  }

  if (
    next.mode === 'guess-time' &&
    next.phase === 'hidden-timing' &&
    prev.round === next.round &&
    prev.phase === 'ready'
  ) {
    return true;
  }

  if (
    next.mode === 'stop-timer' &&
    next.phase === 'stop-timer' &&
    next.running &&
    prev.round === next.round &&
    !prev.running
  ) {
    return true;
  }

  return false;
}

/**
 * True when the client first sees that the timing window has ended.
 * Hidden duration is not on the player view, so guess-time uses the phase leave.
 */
export function shouldPlayTimingEndSound(
  prev: TimingWindowSfxSnapshot | null,
  next: TimingWindowSfxSnapshot,
): boolean {
  if (!prev || prev.round !== next.round) {
    return false;
  }

  if (prev.phase === 'hidden-timing' && next.phase !== 'hidden-timing') {
    return true;
  }

  if (prev.mode === 'stop-timer' && prev.running && !next.running) {
    return true;
  }

  if (prev.phase === 'stop-timer' && next.phase !== 'stop-timer') {
    return true;
  }

  return false;
}

export function timingStartEventKey(roundId: string, mode: TimingWindowSfxSnapshot['mode']): string {
  return mode === 'stop-timer' ? `go:${roundId}:stop` : `go:${roundId}:hidden`;
}

export function timingEndEventKey(roundId: string): string {
  return `timeup:timing:${roundId}`;
}
