'use client';

import { cn } from '@/lib/utils';

export type CharacterFigureProps = {
  name: string;
  accent: 'self' | 'opponent';
  className?: string;
};

/** Lightweight stylized seated figure — no emoji people/chairs. */
export function CharacterFigure({ name, accent, className }: CharacterFigureProps) {
  const isSelf = accent === 'self';

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div
        className={cn(
          'relative flex h-28 w-24 items-end justify-center sm:h-32 sm:w-28',
          isSelf ? 'text-cyan-300' : 'text-rose-300',
        )}
        aria-hidden
      >
        <svg viewBox="0 0 96 120" className="h-full w-full" fill="none">
          <ellipse cx="48" cy="108" rx="28" ry="6" className="fill-current opacity-20" />
          <rect
            x="30"
            y="70"
            width="36"
            height="34"
            rx="10"
            className="fill-current opacity-80"
          />
          <path
            d="M24 78c0-10 8-18 18-18h12c10 0 18 8 18 18v8H24v-8z"
            className="fill-current opacity-55"
          />
          <circle cx="48" cy="36" r="16" className="fill-current" />
          <path
            d="M20 86h16v10c0 4-3 7-7 7h-2c-4 0-7-3-7-7V86zm40 0h16v10c0 4-3 7-7 7h-2c-4 0-7-3-7-7V86z"
            className="fill-current opacity-70"
          />
        </svg>
      </div>
      <p className="max-w-[10rem] truncate text-sm font-semibold text-wanas-text-primary">
        {name}
      </p>
    </div>
  );
}
