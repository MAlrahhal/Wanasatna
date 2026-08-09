'use client';

import type { GuessingChallengeVisibleIdentity } from '@wanasatna/shared';
import { cn } from '@/lib/utils';

export type GuessingChallengeIdentityCardProps = {
  label: string;
  identity: GuessingChallengeVisibleIdentity | null;
  hidden?: boolean;
  highlight?: boolean;
  className?: string;
};

export function GuessingChallengeIdentityCard({
  label,
  identity,
  hidden = false,
  highlight = false,
  className,
}: GuessingChallengeIdentityCardProps) {
  const display =
    hidden || !identity
      ? '؟؟؟'
      : identity.type === 'text'
        ? (identity.value ?? '؟؟؟')
        : 'صورة';

  return (
    <div
      className={cn(
        'wanas-game-card flex min-h-[5.5rem] w-full max-w-[16rem] flex-col justify-center rounded-2xl border px-4 py-5 text-center sm:min-h-[6.5rem] sm:px-5',
        highlight
          ? 'border-wanas-success-border/80 bg-wanas-success-surface'
          : 'border-border bg-card',
        className,
      )}
    >
      <p className="text-[0.7rem] font-medium tracking-wide text-wanas-text-muted">{label}</p>
      <p
        className={cn(
          'mt-2 break-words text-xl font-bold sm:text-2xl',
          hidden || !identity ? 'text-wanas-text-muted' : 'text-wanas-text-primary',
          highlight && 'text-wanas-success-dark',
        )}
      >
        {display}
      </p>
    </div>
  );
}
