import { normalizeTextAnswer } from '@wanasatna/shared';

export const normalizeAnswerText = normalizeTextAnswer;

export function isCorrectAnswer(answer: string, acceptedAnswers: readonly string[]): boolean {
  const normalized = normalizeAnswerText(answer);

  if (!normalized) {
    return false;
  }

  return acceptedAnswers.some((accepted) => normalizeAnswerText(accepted) === normalized);
}

export function revealPrimaryAnswer(acceptedAnswers: readonly string[]): string {
  return acceptedAnswers[0]?.trim() || '';
}
