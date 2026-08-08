import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type GameCardProps = HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  children: ReactNode;
};

export function GameCard({ interactive = false, className, children, ...props }: GameCardProps) {
  return (
    <div
      className={cn('wanas-game-card min-w-0', interactive && 'wanas-game-card-interactive', className)}
      {...props}
    >
      {children}
    </div>
  );
}

type GameScreenProps = {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  maxWidth?: '3xl' | '4xl' | '6xl';
};

const maxWidthClasses = {
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '6xl': 'max-w-6xl',
} as const;

export function GameScreen({
  ariaLabel,
  children,
  className,
  maxWidth = '6xl',
}: GameScreenProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        'wanas-game-screen mx-auto flex w-full flex-col gap-6 sm:gap-7 lg:gap-8',
        maxWidthClasses[maxWidth],
        className,
      )}
    >
      {children}
    </section>
  );
}
