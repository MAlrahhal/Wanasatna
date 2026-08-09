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
