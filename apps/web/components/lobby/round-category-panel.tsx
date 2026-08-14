'use client';

import { FAST_ANSWER_GAME_ID, GUESSING_CHALLENGE_GAME_ID, JUDGE_GAME_ID, WHO_WROTE_IT_GAME_ID } from '@wanasatna/shared';
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
        'inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition-colors sm:h-9 sm:text-xs',
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

  const lockForMatch =
    gameId === FAST_ANSWER_GAME_ID ||
    gameId === WHO_WROTE_IT_GAME_ID ||
    gameId === JUDGE_GAME_ID ||
    gameId === GUESSING_CHALLENGE_GAME_ID;

  if (lockForMatch && isActiveMatch) {
    return null;
  }

  const resolvedSelectedId =
    selectedCategoryId && config.categories.some((category) => category.id === selectedCategoryId)
      ? selectedCategoryId
      : config.defaultCategoryId;

  const subtitle = lockForMatch
    ? 'اختر الفئة التي تريد اللعب بها طوال المباراة'
    : isActiveMatch
      ? 'اختر الفئة التي تريد اللعب بها في الجولة التالية'
      : 'اختر الفئة التي تريد اللعب بها في الجولة الأولى';

  const footer =
    gameId === FAST_ANSWER_GAME_ID
      ? 'تُقفل الفئة عند بدء المباراة وتستخدم لكل الجولات الخمس'
      : gameId === WHO_WROTE_IT_GAME_ID
        ? 'تُقفل الفئة عند بدء المباراة وتستخدم لكل الجولات الثلاث'
        : gameId === JUDGE_GAME_ID
        ? 'تُقفل الفئة عند بدء المباراة، ويأخذ كل لاعب دور القاضي مرة واحدة'
        : gameId === GUESSING_CHALLENGE_GAME_ID
          ? 'تُقفل الفئة عند بدء المباراة وتستخدم لكل الجولات الأربع'
          : 'سيتم استخدام هذه الفئة فقط للجولة القادمة، ويمكن تغييرها قبل كل جولة جديدة';

  return (
    <section
      aria-label="فئة الجولة"
      className="rounded-xl border border-wanas-border bg-wanas-surface px-3 py-2.5"
    >
      <div className="flex items-start gap-2">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-wanas-primary-surface text-sm"
          aria-hidden
        >
          🎲
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-wanas-text-primary">
            {lockForMatch ? 'فئة المباراة' : 'فئة الجولة التالية'}
          </h3>
          <p className="text-[11px] leading-4 text-wanas-text-muted">{subtitle}</p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-5">
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

      <p className="mt-2 text-[11px] leading-4 text-wanas-text-muted">{footer}</p>
    </section>
  );
}
