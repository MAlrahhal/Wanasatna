import { randomBytes } from 'node:crypto';
import { WHO_WROTE_IT_MAX_ANSWER_LENGTH } from '@wanasatna/shared';

export function createOpaqueAnswerId(): string {
  return `ans_${randomBytes(8).toString('hex')}`;
}

export function normalizeSubmittedAnswer(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function validateSubmittedAnswer(
  raw: unknown,
): { ok: true; text: string } | { ok: false; message: string } {
  if (typeof raw !== 'string') {
    return { ok: false, message: 'الإجابة غير صالحة.' };
  }

  const text = normalizeSubmittedAnswer(raw);

  if (!text) {
    return { ok: false, message: 'لا يمكن إرسال إجابة فارغة.' };
  }

  if (text.length > WHO_WROTE_IT_MAX_ANSWER_LENGTH) {
    return {
      ok: false,
      message: `الإجابة طويلة جداً (الحد ${WHO_WROTE_IT_MAX_ANSWER_LENGTH} حرفاً).`,
    };
  }

  return { ok: true, text };
}

export function shuffleIds(ids: readonly string[]): string[] {
  const next = [...ids];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = next[index]!;
    next[index] = next[swapIndex]!;
    next[swapIndex] = current;
  }

  return next;
}
