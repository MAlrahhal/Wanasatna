'use client';

import type { GuessingChallengeVisibleIdentity } from '@wanasatna/shared';
import { cn } from '@/lib/utils';
import { resolveIdentityCardText, splitIdentityDisplayLines } from './identity-display';

export type GuessingChallengeIdentityCardProps = {
  label: string;
  identity: GuessingChallengeVisibleIdentity | null;
  hidden?: boolean;
  highlight?: boolean;
  size?: 'distant' | 'foreground';
  className?: string;
  'data-testid'?: string;
};

export { resolveIdentityCardText } from './identity-display';

export function GuessingChallengeIdentityCard({
  label,
  identity,
  hidden = false,
  highlight = false,
  size = 'distant',
  className,
  'data-testid': dataTestId,
}: GuessingChallengeIdentityCardProps) {
  const display = resolveIdentityCardText(identity, hidden);
  const isHidden = hidden || !identity;
  const displayLines = splitIdentityDisplayLines(display);

  return (
    <div
      data-testid={dataTestId}
      className={cn(
        'flex w-full flex-col justify-center rounded-2xl border text-center',
        size === 'distant' && 'min-h-[4.25rem] max-w-[13.5rem] px-3 py-3 sm:min-h-[4.75rem]',
        size === 'foreground' && 'min-h-[5.5rem] max-w-[18rem] px-4 py-4 sm:min-h-[6.25rem] sm:px-5',
        highlight
          ? 'border-wanas-success-border/80 bg-wanas-success-surface'
          : 'border-slate-500/40 bg-slate-900/95',
        className,
      )}
    >
      <p className="text-[0.65rem] font-medium tracking-wide text-wanas-text-muted sm:text-[0.7rem]">
        {label}
      </p>
      <p
        data-testid={dataTestId ? `${dataTestId}-value` : undefined}
        className={cn(
          'mt-1.5 whitespace-pre-line break-words text-center font-bold leading-tight',
          size === 'distant' ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl',
          isHidden ? 'text-wanas-text-muted' : 'text-wanas-text-primary',
          highlight && 'text-wanas-success-dark',
        )}
      >
        {displayLines.join('\n')}
      </p>
    </div>
  );
}
