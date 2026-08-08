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
      <span
        className={cn(
          'text-xs font-medium',
          isLowTime ? 'text-wanas-warning-dark' : 'text-wanas-text-muted',
        )}
      >
        ⏱
      </span>
      <span
        className={cn(
          'font-mono text-sm font-semibold tabular-nums',
          isLowTime ? 'text-wanas-warning-dark' : 'text-wanas-text-primary',
        )}
      >
        {label}
      </span>
    </div>
  );
}
