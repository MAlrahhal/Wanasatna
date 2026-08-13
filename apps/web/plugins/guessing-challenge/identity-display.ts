import type { GuessingChallengeVisibleIdentity } from '@wanasatna/shared';

export function resolveIdentityCardText(
  identity: GuessingChallengeVisibleIdentity | null,
  hidden: boolean,
): string {
  if (hidden || !identity) {
    return '؟؟؟';
  }

  if (identity.type === 'text') {
    return identity.value?.trim() || '؟؟؟';
  }

  return 'صورة';
}

/** Two-word names become two lines; longer phrases stay as wrap candidates. */
export function splitIdentityDisplayLines(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 2) {
    return words;
  }

  return [trimmed];
}
