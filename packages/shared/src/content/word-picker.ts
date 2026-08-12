import type { GameContentBundle, GameContentCategory, GameContentWord } from './types.js';

export function resolveEnabledCategoryIds(
  categories: GameContentCategory[],
  enabledCategoryIds?: string[],
): Set<string> {
  const selectedIds =
    enabledCategoryIds && enabledCategoryIds.length > 0
      ? enabledCategoryIds
      : categories.filter((category) => category.enabled).map((category) => category.id);

  return new Set(selectedIds);
}

export function pickRandomWord(
  words: GameContentWord[],
  categories: GameContentCategory[],
  enabledCategoryIds?: string[],
  excludeTexts?: ReadonlySet<string> | readonly string[],
): GameContentWord | null {
  const activeCategoryIds = resolveEnabledCategoryIds(categories, enabledCategoryIds);
  const excluded = excludeTexts
    ? excludeTexts instanceof Set
      ? excludeTexts
      : new Set(excludeTexts)
    : null;

  const eligibleWords = words.filter((word) => activeCategoryIds.has(word.categoryId));
  const unusedWords = excluded
    ? eligibleWords.filter((word) => !excluded.has(word.text))
    : eligibleWords;
  const pool = unusedWords.length > 0 ? unusedWords : eligibleWords;

  if (pool.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? null;
}

export function pickRandomWordFromCategories(
  bundle: GameContentBundle,
  enabledCategoryIds?: string[],
  excludeTexts?: ReadonlySet<string> | readonly string[],
): GameContentWord | null {
  return pickRandomWord(bundle.words, bundle.categories, enabledCategoryIds, excludeTexts);
}

export function pickRandomWordText(
  bundle: GameContentBundle,
  enabledCategoryIds?: string[],
  excludeTexts?: ReadonlySet<string> | readonly string[],
): string | null {
  const word = pickRandomWordFromCategories(bundle, enabledCategoryIds, excludeTexts);
  return word?.text ?? null;
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index]!;
    copy[index] = copy[swapIndex]!;
    copy[swapIndex] = current;
  }

  return copy;
}

/**
 * Builds unique multiple-choice options for the impostor from the same category.
 * Cross-category fill is not used when the category pool is production-sized.
 * Thin pools return fewer same-category options rather than mixing categories.
 */
export function buildImpostorGuessOptions(
  bundle: GameContentBundle,
  secretWord: string,
  categoryId: string,
  optionCount = 8,
): string[] {
  const sameCategoryDistractors = [
    ...new Set(
      bundle.words
        .filter((word) => word.categoryId === categoryId && word.text !== secretWord)
        .map((word) => word.text),
    ),
  ];

  const distractorCount = Math.max(0, optionCount - 1);
  const selectedDistractors = shuffleArray(sameCategoryDistractors).slice(0, distractorCount);

  return shuffleArray([secretWord, ...selectedDistractors]);
}
