'use client';

import { cn } from '@/lib/utils';

export type SpecialCardButtonProps = {
  variant: 'yellow' | 'red';
  title: string;
  description: string;
  available: boolean;
  disabled?: boolean;
  onClick?: () => void;
  compact?: boolean;
};

export function SpecialCardButton({
  variant,
  title,
  description,
  available,
  disabled = false,
  onClick,
  compact = false,
}: SpecialCardButtonProps) {
  const used = !available;

  return (
    <button
      type="button"
      disabled={disabled || used}
      onClick={onClick}
      data-testid={variant === 'yellow' ? 'gc-yellow-card' : 'gc-red-card'}
      data-available={available ? 'true' : 'false'}
      className={cn(
        'flex flex-col justify-center rounded-xl border text-right shadow-[0_8px_18px_rgb(0_0_0_/0.28)] transition-colors',
        compact ? 'min-h-[4.25rem] px-2.5 py-2' : 'min-h-[5.5rem] flex-1 px-4 py-3',
        variant === 'yellow' &&
          'border-amber-400/55 bg-amber-500/15 text-amber-100 disabled:border-amber-400/20 disabled:bg-amber-500/5 disabled:text-amber-100/50',
        variant === 'red' &&
          'border-rose-400/55 bg-rose-500/15 text-rose-100 disabled:border-rose-400/20 disabled:bg-rose-500/5 disabled:text-rose-100/50',
        used && 'opacity-55 grayscale-[0.35]',
        !disabled && !used && 'hover:bg-white/5',
      )}
    >
      <span className={cn('font-bold', compact ? 'text-xs' : 'text-sm')}>{title}</span>
      <span
        className={cn(
          'mt-1 text-wanas-text-muted',
          compact ? 'text-[0.65rem] leading-snug' : 'text-xs',
        )}
      >
        {used ? 'تم الاستخدام' : description}
      </span>
    </button>
  );
}
