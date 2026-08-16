'use client';

import { useDeadlineClock } from '@/lib/game/use-deadline-clock';
import { cn } from '@/lib/utils';

export type DeadlineProgressProps = {
  deadlineAtMs?: number | null;
  remainingSeconds?: number;
  totalDurationSeconds: number;
  className?: string;
};

export function DeadlineProgress({
  deadlineAtMs,
  remainingSeconds = 0,
  totalDurationSeconds,
  className,
}: DeadlineProgressProps) {
  const liveRemaining = useDeadlineClock(deadlineAtMs);
  const total = Math.max(totalDurationSeconds, 1);
  const remaining = Math.max(
    0,
    Math.min(deadlineAtMs != null ? liveRemaining : remainingSeconds, total),
  );
  const progressPercent = Math.round((remaining / total) * 100);

  return (
    <div
      className={cn('h-1.5 overflow-hidden rounded-full bg-wanas-surface-muted', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={remaining}
      aria-label={`الانتقال التلقائي ${remaining} من ${total} ثانية`}
    >
      <div
        className="h-full rounded-full bg-wanas-accent transition-[width] duration-200 ease-linear"
        style={{ width: `${progressPercent}%` }}
      />
    </div>
  );
}
