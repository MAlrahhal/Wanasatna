'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ElectronicPanelProps = {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
};

export function ElectronicPanel({ children, className, ariaLabel }: ElectronicPanelProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        'rounded-2xl border border-wanas-border bg-wanas-surface px-5 py-6 sm:px-8 sm:py-8',
        className,
      )}
    >
      {children}
    </section>
  );
}

type DigitalTimerDisplayProps = {
  /** Preformatted digital value, e.g. `00:07.35` or `--:--.--`. */
  value: string;
  label?: string;
  className?: string;
  running?: boolean;
};

/**
 * Compact modern digital/electronic timer readout.
 * Visual inspiration only — not a physical stopwatch recreation.
 */
export function DigitalTimerDisplay({
  value,
  label,
  className,
  running = false,
}: DigitalTimerDisplayProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      {label ? (
        <p className="text-sm font-semibold text-wanas-text-muted">{label}</p>
      ) : null}
      <div
        className={cn(
          'inline-flex min-w-[12.5rem] items-center justify-center rounded-xl border border-wanas-border px-4 py-3 sm:min-w-[14rem] sm:px-5',
          'bg-[#0a0a16]',
          running && 'border-wanas-accent/40',
        )}
        dir="ltr"
      >
        <span
          className={cn(
            'font-mono text-[1.75rem] font-bold tabular-nums tracking-[0.08em] text-wanas-accent sm:text-[2.15rem]',
            value.includes('-') && 'text-wanas-text-muted',
          )}
          aria-hidden={value.includes('-') ? true : undefined}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

/** @deprecated Prefer DigitalTimerDisplay — kept as thin alias for existing call sites. */
export function DigitalReadout({
  value,
  unit: _unit,
  className,
}: {
  value: string;
  unit?: string;
  className?: string;
}) {
  return <DigitalTimerDisplay value={value} className={className} />;
}
