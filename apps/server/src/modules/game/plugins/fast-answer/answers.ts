/** Normalize Arabic (and mixed) answers for comparison. Does NOT map ة→ه. */
export function normalizeAnswerText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u0640/g, '')
    .replace(/[أإآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isCorrectAnswer(answer: string, acceptedAnswers: readonly string[]): boolean {
  const normalized = normalizeAnswerText(answer);

  if (!normalized) {
    return false;
  }

  return acceptedAnswers.some(
    (accepted) => normalizeAnswerText(accepted) === normalized,
  );
}

export function revealPrimaryAnswer(acceptedAnswers: readonly string[]): string {
  return acceptedAnswers[0]?.trim() || '';
}
