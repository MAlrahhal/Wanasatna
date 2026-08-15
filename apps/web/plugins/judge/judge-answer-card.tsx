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
      aria-pressed={selected}
      onClick={interactive ? onSelect : undefined}
      className={cn(
        'flex min-h-16 w-full items-start gap-2 rounded-[1.25rem] border px-4 py-3 text-right transition-colors sm:min-h-24 sm:items-center sm:py-4',
        'border-wanas-border bg-[color:var(--wanas-game-card)]',
        interactive &&
          'hover:border-wanas-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/40',
        selected && 'border-wanas-accent bg-wanas-accent/10 ring-1 ring-wanas-accent/25',
        !interactive && 'cursor-default',
      )}
    >
      <p className="min-w-0 flex-1 break-words text-sm font-semibold leading-relaxed text-wanas-text-primary sm:text-lg">
        «{text}»
      </p>
      {selected ? (
        <span className="mt-0.5 shrink-0 rounded-full bg-wanas-accent px-2 py-0.5 text-xs font-bold text-white">
          ✓
        </span>
      ) : null}
    </button>
  );
}
