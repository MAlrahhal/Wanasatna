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
