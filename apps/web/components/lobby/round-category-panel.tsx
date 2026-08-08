'use client';

import {
  getGameRoundCategories,
  type RoundCategory,
} from '@/lib/game/round-categories';
import { cn } from '@/lib/utils';

type RoundCategoryPanelProps = {
  gameId: string | null;
  selectedCategoryId: string | null;
  isHost: boolean;
  /** True while a match shell is active (countdown/playing), including between rounds. */
  isActiveMatch: boolean;
  onSelectCategory: (categoryId: string) => void;
};

function CategoryChip({
  category,
  selected,
  disabled,
  onSelect,
}: {
  category: RoundCategory;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors sm:h-10 sm:px-3.5 sm:text-sm',
        'border',
        selected
          ? 'border-wanas-accent bg-wanas-accent text-white'
          : 'border-wanas-border-strong bg-wanas-surface text-wanas-text-primary',
        disabled && !selected && 'cursor-default opacity-90',
        disabled && selected && 'cursor-default',
        !disabled && !selected && 'hover:border-wanas-accent/50',
      )}
    >
      <span aria-hidden className="text-sm leading-none sm:text-base">
        {category.emoji}
      </span>
      <span className={selected ? 'text-white' : undefined}>{category.label}</span>
    </button>
  );
}

export function RoundCategoryPanel({
  gameId,
  selectedCategoryId,
  isHost,
  isActiveMatch,
  onSelectCategory,
}: RoundCategoryPanelProps) {
  const config = getGameRoundCategories(gameId);

  if (!config) {
    return null;
  }

  const resolvedSelectedId =
    selectedCategoryId && config.categories.some((category) => category.id === selectedCategoryId)
      ? selectedCategoryId
      : config.defaultCategoryId;

  const subtitle = isActiveMatch
    ? 'اختر الفئة التي تريد اللعب بها في الجولة التالية'
    : 'اختر الفئة التي تريد اللعب بها في الجولة الأولى';

  return (
    <section
      aria-label="فئة الجولة"
      className="rounded-xl border border-wanas-border bg-wanas-surface-soft p-3 sm:p-4"
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-wanas-border bg-wanas-surface text-xl"
          aria-hidden
        >
          🎲
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-wanas-text-primary">فئة الجولة التالية</h3>
          <p className="mt-0.5 text-xs leading-5 text-wanas-text-muted">{subtitle}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {config.categories.map((category) => (
          <CategoryChip
            key={category.id}
            category={category}
            selected={category.id === resolvedSelectedId}
            disabled={!isHost}
            onSelect={() => onSelectCategory(category.id)}
          />
        ))}
      </div>

      <p className="mt-3 text-center text-[11px] leading-5 text-wanas-text-muted sm:text-xs">
        سيتم استخدام هذه الفئة فقط للجولة القادمة، ويمكن تغييرها قبل كل جولة جديدة
      </p>
    </section>
  );
}
