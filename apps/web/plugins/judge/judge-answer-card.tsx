'use client';

import { cn } from '@/lib/utils';

export type JudgeAnswerCardProps = {
  text: string;
  selectable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
};

export function JudgeAnswerCard({
  text,
  selectable = false,
  selected = false,
  disabled = false,
  onSelect,
}: JudgeAnswerCardProps) {
  const interactive = selectable && !disabled;

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={interactive ? onSelect : undefined}
      className={cn(
        'flex min-h-24 w-full items-center rounded-[1.25rem] border px-4 py-4 text-right transition-colors',
        'border-wanas-border bg-[color:var(--wanas-game-card)]',
        interactive &&
          'hover:border-wanas-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/40',
        selected && 'border-wanas-accent bg-wanas-accent/10',
        !interactive && 'cursor-default',
      )}
    >
      <p className="break-words text-base font-semibold leading-relaxed text-wanas-text-primary sm:text-lg">
        «{text}»
      </p>
    </button>
  );
}
