/** Format milliseconds as digital stopwatch `MM:SS.cc`. */
export function formatDigitalTimer(ms: number): string {
  const totalMs = Math.max(0, Math.round(ms));
  const minutes = Math.floor(totalMs / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const centiseconds = Math.floor((totalMs % 1000) / 10);

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

/** Compact seconds readout still used for deltas / peer lists. */
export function formatSecondsFromMs(ms: number): string {
  return (ms / 1000).toFixed(2);
}

export function formatSignedDeltaMs(signedDeltaMs: number): string {
  const seconds = (Math.abs(signedDeltaMs) / 1000).toFixed(2);
  if (signedDeltaMs > 0) {
    return `+${seconds} ثانية`;
  }
  if (signedDeltaMs < 0) {
    return `-${seconds} ثانية`;
  }
  return '0.00 ثانية';
}

export function timingFeedbackLabel(errorMs: number | null): string | null {
  if (errorMs === null) {
    return null;
  }
  if (errorMs <= 100) {
    return '🔥 قريب جدًا';
  }
  if (errorMs <= 500) {
    return 'ممتاز';
  }
  if (errorMs >= 2000) {
    return 'حاول الجولة الجاية';
  }
  return null;
}
