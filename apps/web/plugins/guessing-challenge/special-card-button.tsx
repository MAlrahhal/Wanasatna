'use client';

import { cn } from '@/lib/utils';

export type SpecialCardButtonProps = {
  variant: 'yellow' | 'red';
  title: string;
  description: string;
  available: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

export function SpecialCardButton({
  variant,
  title,
  description,
  available,
  disabled = false,
  onClick,
}: SpecialCardButtonProps) {
  const used = !available;

  return (
    <button
      type="button"
      disabled={disabled || used}
      onClick={onClick}
      className={cn(
        'flex min-h-[5.5rem] flex-1 flex-col justify-center rounded-2xl border px-4 py-3 text-right transition-colors',
        variant === 'yellow' &&
          'border-amber-400/50 bg-amber-400/10 text-amber-100 disabled:border-amber-400/20 disabled:bg-amber-400/5',
        variant === 'red' &&
          'border-rose-400/50 bg-rose-500/10 text-rose-100 disabled:border-rose-400/20 disabled:bg-rose-500/5',
        !disabled && !used && 'hover:bg-white/5',
      )}
    >
      <span className="text-sm font-bold">{title}</span>
      <span className="mt-1 text-xs text-wanas-text-muted">
        {used ? 'تم الاستخدام' : description}
      </span>
    </button>
  );
}
