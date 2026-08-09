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
        'rounded-2xl border border-wanas-border bg-wanas-surface px-5 py-8 sm:px-8 sm:py-10',
        className,
      )}
    >
      {children}
    </section>
  );
}

type DigitalReadoutProps = {
  value: string;
  unit?: string;
  className?: string;
};

export function DigitalReadout({ value, unit = 'ثانية', className }: DigitalReadoutProps) {
  return (
    <div className={cn('text-center', className)}>
      <p
        className="font-mono text-5xl font-bold tracking-tight text-wanas-accent sm:text-6xl"
        dir="ltr"
      >
        {value}
      </p>
      {unit ? (
        <p className="mt-2 text-sm font-semibold text-wanas-text-muted">{unit}</p>
      ) : null}
    </div>
  );
}
