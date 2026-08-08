import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SectionHeaderProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  align?: 'start' | 'center';
  className?: string;
  tone?: 'default' | 'light';
};

export function SectionHeader({
  title,
  description,
  icon,
  align = 'start',
  className,
  tone = 'default',
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'space-y-2.5',
        align === 'center' && 'mx-auto max-w-2xl text-center',
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            'flex size-10 items-center justify-center rounded-[var(--wanas-radius-control)] border border-wanas-border bg-wanas-surface text-wanas-primary shadow-[var(--wanas-shadow-panel)]',
            align === 'center' && 'mx-auto',
          )}
        >
          {icon}
        </div>
      ) : null}
      {!icon ? (
        <span
          aria-hidden
          className={cn(
            'block h-1 w-10 rounded-full bg-wanas-accent',
            align === 'center' && 'mx-auto',
          )}
        />
      ) : null}
      <h2
        className={cn(
          'text-2xl font-extrabold tracking-tight sm:text-3xl',
          tone === 'light' ? 'text-white' : 'text-wanas-text-primary',
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className={cn('text-sm leading-7 sm:text-base', tone === 'light' ? 'text-white/85' : 'text-wanas-text-secondary')}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
