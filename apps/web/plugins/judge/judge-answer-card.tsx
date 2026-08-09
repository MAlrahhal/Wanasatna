'use client';

import { cn } from '@/lib/utils';

export type JudgeAnswerCardProps = {
  text: string;
  selectable?: boolean;
  selected?: boolean;
  isWinner?: boolean;
  ownerName?: string | null;
  disabled?: boolean;
  onSelect?: () => void;
};

export function JudgeAnswerCard({
  text,
  selectable = false,
  selected = false,
  isWinner = false,
  ownerName = null,
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
        'wanas-game-card flex min-h-28 w-full flex-col items-stretch rounded-[1.25rem] px-4 py-5 text-right transition-colors',
        interactive && 'border-wanas-border-strong hover:border-wanas-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/40',
        selected && 'border-wanas-accent bg-wanas-accent/10',
        isWinner && 'border-wanas-success-border bg-wanas-success-surface',
        !interactive && 'cursor-default',
      )}
    >
      <p className="break-words text-base font-semibold leading-relaxed text-wanas-text-primary sm:text-lg">
        «{text}»
      </p>
      {ownerName ? (
        <p
          className={cn(
            'mt-3 text-sm font-semibold',
            isWinner ? 'text-wanas-success-dark' : 'text-wanas-text-muted',
          )}
        >
          {ownerName}
          {isWinner ? ' ⭐' : ''}
        </p>
      ) : null}
      {interactive && selected ? (
        <p className="mt-3 text-xs font-medium text-wanas-accent">اختيار هذه الإجابة</p>
      ) : null}
    </button>
  );
}
