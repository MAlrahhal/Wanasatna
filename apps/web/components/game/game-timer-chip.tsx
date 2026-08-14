'use client';

import { cn } from '@/lib/utils';

type GameTimerChipProps = {
  remainingSeconds: number;
  format?: 'mm:ss' | 'seconds';
  lowTimeThreshold?: number;
  className?: string;
};

function formatTimer(totalSeconds: number, format: 'mm:ss' | 'seconds'): string {
  if (format === 'seconds') {
    return `${totalSeconds} ثانية`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function GameTimerChip({
  remainingSeconds,
  format = 'mm:ss',
  lowTimeThreshold = 10,
  className,
}: GameTimerChipProps) {
  const isLowTime = remainingSeconds <= lowTimeThreshold;
  const label = formatTimer(remainingSeconds, format);

  return (
    <div
      className={cn(
        'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border px-2 py-0.5 shadow-sm transition-colors duration-200 sm:min-h-10 sm:gap-2 sm:px-2.5 sm:py-1',
        isLowTime
          ? 'border-wanas-warning-border bg-wanas-warning-surface'
          : 'border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)]',
        className,
      )}
      aria-label={`الوقت المتبقي ${label}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className={cn(isLowTime ? 'text-wanas-warning-dark' : 'text-wanas-text-muted')}
      >
        <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 9v4l2.5 1.5M9 4h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span
        className={cn(
          'font-mono text-sm font-semibold tabular-nums leading-5',
          isLowTime ? 'text-wanas-warning-dark' : 'text-wanas-text-primary',
        )}
      >
        {label}
      </span>
    </div>
  );
}
