'use client';

import { cn } from '@/lib/utils';

export type CharacterFigureProps = {
  name: string;
  accent?: 'self' | 'opponent';
  className?: string;
  showName?: boolean;
  size?: 'normal' | 'distant';
};

/** Lightweight stylized seated figure — reused for opponent across the table. */
export function CharacterFigure({
  name,
  accent = 'opponent',
  className,
  showName = true,
  size = 'normal',
}: CharacterFigureProps) {
  const isOpponent = accent === 'opponent';

  return (
    <div
      className={cn('flex flex-col items-center gap-1.5', className)}
      data-testid={isOpponent ? 'gc-opponent-character' : 'gc-self-character'}
    >
      <div
        className={cn(
          'relative flex items-end justify-center',
          size === 'distant' ? 'h-24 w-20 sm:h-28 sm:w-24' : 'h-28 w-24 sm:h-32 sm:w-28',
          isOpponent ? 'text-rose-300' : 'text-cyan-300',
        )}
        aria-hidden
      >
        <svg viewBox="0 0 96 120" className="h-full w-full" fill="none">
          <ellipse cx="48" cy="110" rx="26" ry="5" className="fill-current opacity-15" />
          {/* chair back */}
          <rect
            x="22"
            y="58"
            width="52"
            height="18"
            rx="7"
            className="fill-slate-600 opacity-70"
          />
          {/* torso */}
          <path
            d="M28 70c0-12 9-20 20-20h0c11 0 20 8 20 20v16H28V70z"
            className="fill-current opacity-85"
          />
          {/* arms on table */}
          <path
            d="M18 84c8-6 16-8 30-8s22 2 30 8c-4 4-12 7-30 7s-26-3-30-7z"
            className="fill-current opacity-45"
          />
          {/* head */}
          <circle cx="48" cy="34" r="15" className="fill-current" />
          {/* hair accent */}
          <path
            d="M34 28c2-10 10-14 14-14s12 4 14 14c-6-4-10-5-14-5s-8 1-14 5z"
            className="fill-current opacity-55"
          />
          {/* seat */}
          <rect
            x="26"
            y="86"
            width="44"
            height="14"
            rx="6"
            className="fill-slate-500 opacity-55"
          />
          {/* legs */}
          <path
            d="M30 98h12v10c0 3-2 5-5 5h-2c-3 0-5-2-5-5V98zm24 0h12v10c0 3-2 5-5 5h-2c-3 0-5-2-5-5V98z"
            className="fill-current opacity-65"
          />
        </svg>
      </div>
      {showName ? (
        <p
          data-testid={isOpponent ? 'gc-opponent-name' : 'gc-self-name'}
          className="max-w-[10rem] truncate text-sm font-semibold text-wanas-text-primary"
        >
          {name}
        </p>
      ) : null}
    </div>
  );
}
