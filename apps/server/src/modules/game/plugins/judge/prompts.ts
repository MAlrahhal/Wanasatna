import type { GameContentWord } from '@wanasatna/shared';
import { JUDGE_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { getRoomRoundCategory } from '../../runtime/round-category-store.js';

export const JUDGE_RANDOM_CATEGORY_ID = 'random';
export const JUDGE_RANDOM_CATEGORY_LABEL = 'عشوائي';

export type JudgeCategoryOption = {
  id: string;
  label: string;
};

export type ResolvedMatchCategory = {
  matchCategoryId: string;
  matchCategoryLabel: string;
};

function categoriesWithPrompts(
  prompts: readonly GameContentWord[],
  categories: readonly { id: string; name: string; enabled: boolean }[],
): JudgeCategoryOption[] {
  return categories
    .filter((category) => category.enabled)
    .filter((category) => prompts.some((prompt) => prompt.categoryId === category.id))
    .map((category) => ({ id: category.id, label: category.name }));
}

function loadCategoryPool(): JudgeCategoryOption[] {
  const content = getLoadedGameContent(JUDGE_GAME_ID);

  if (!content) {
    throw new Error('Judge content is not loaded.');
  }

  const prompts = content.bundle.words ?? [];
  const pool = categoriesWithPrompts(prompts, content.bundle.categories);

  if (pool.length === 0) {
    throw new Error('No Judge categories with prompts are available.');
  }

  return pool;
}

export function resolveMatchCategorySelection(roomId: string): ResolvedMatchCategory {
  const pool = loadCategoryPool();
  const requested = getRoomRoundCategory(roomId);

  if (requested && requested !== JUDGE_RANDOM_CATEGORY_ID) {
    const matched = pool.find((category) => category.id === requested);
    if (matched) {
      return {
        matchCategoryId: matched.id,
        matchCategoryLabel: matched.label,
      };
    }
  }

  return {
    matchCategoryId: JUDGE_RANDOM_CATEGORY_ID,
    matchCategoryLabel: JUDGE_RANDOM_CATEGORY_LABEL,
  };
}

export function chooseRoundCategoryId(
  matchCategoryId: string,
  usedRoundCategoryIds: readonly string[],
  poolIds: readonly string[],
  randomIndex: (exclusiveMax: number) => number = (exclusiveMax) =>
    Math.floor(Math.random() * exclusiveMax),
): string {
  if (poolIds.length === 0) {
    throw new Error('No Judge categories available.');
  }

  if (matchCategoryId !== JUDGE_RANDOM_CATEGORY_ID && poolIds.includes(matchCategoryId)) {
    return matchCategoryId;
  }

  const used = new Set(usedRoundCategoryIds);
  const unused = poolIds.filter((id) => !used.has(id));
  const candidates = unused.length > 0 ? unused : [...poolIds];
  const index = Math.max(0, Math.min(candidates.length - 1, randomIndex(candidates.length)));
  return candidates[index]!;
}

export function pickRoundCategoryId(
  matchCategoryId: string,
  usedRoundCategoryIds: readonly string[],
): string {
  return chooseRoundCategoryId(
    matchCategoryId,
    usedRoundCategoryIds,
    loadCategoryPool().map((category) => category.id),
  );
}

export function pickJudgePrompt(
  categoryId: string,
  recentPromptIds: readonly string[],
): GameContentWord {
  const content = getLoadedGameContent(JUDGE_GAME_ID);

  if (!content) {
    throw new Error('Judge content is not loaded.');
  }

  const prompts = content.bundle.words ?? [];
  const inCategory = prompts.filter((prompt) => prompt.categoryId === categoryId);

  if (inCategory.length === 0) {
    throw new Error('No prompts available for the selected Judge category.');
  }

  const recent = new Set(recentPromptIds);
  const fresh = inCategory.filter((prompt) => !recent.has(prompt.id));
  const pool = fresh.length > 0 ? fresh : inCategory;
  const index = Math.floor(Math.random() * pool.length);
  const picked = pool[index];

  if (!picked) {
    throw new Error('Failed to pick a Judge prompt.');
  }

  return picked;
}
