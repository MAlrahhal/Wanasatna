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
): GameContentWord | null {
  const activeCategoryIds = resolveEnabledCategoryIds(categories, enabledCategoryIds);
  const eligibleWords = words.filter((word) => activeCategoryIds.has(word.categoryId));

  if (eligibleWords.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * eligibleWords.length);
  return eligibleWords[index] ?? null;
}

export function pickRandomWordFromCategories(
  bundle: GameContentBundle,
  enabledCategoryIds?: string[],
): GameContentWord | null {
  return pickRandomWord(bundle.words, bundle.categories, enabledCategoryIds);
}

export function pickRandomWordText(
  bundle: GameContentBundle,
  enabledCategoryIds?: string[],
): string | null {
  const word = pickRandomWordFromCategories(bundle, enabledCategoryIds);
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

export function buildImpostorGuessOptions(
  bundle: GameContentBundle,
  secretWord: string,
  categoryId: string,
  optionCount = 8,
): string[] {
  const uniqueDistractorTexts = [
    ...new Set(
      bundle.words
        .filter((word) => word.categoryId === categoryId && word.text !== secretWord)
        .map((word) => word.text),
    ),
  ];

  const distractorCount = Math.max(0, optionCount - 1);
  const selectedDistractors = shuffleArray(uniqueDistractorTexts).slice(0, distractorCount);

  return shuffleArray([secretWord, ...selectedDistractors]);
}
