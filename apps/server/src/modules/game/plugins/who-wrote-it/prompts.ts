import type { GameContentWord } from '@wanasatna/shared';
import { WHO_WROTE_IT_GAME_ID, resolveEnabledCategoryIds } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { resolveEnabledCategoryFilter } from '../../runtime/round-category-store.js';

export function pickWhoWroteItPrompt(
  roomId: string,
  recentQuestionIds: readonly string[],
): GameContentWord {
  const content = getLoadedGameContent(WHO_WROTE_IT_GAME_ID);

  if (!content) {
    throw new Error('Who Wrote It content is not loaded.');
  }

  const prompts = content.bundle.words;
  const enabledCategoryIds = resolveEnabledCategoryIds(
    content.bundle.categories,
    resolveEnabledCategoryFilter(roomId) ?? content.settings.enabledCategories,
  );

  const inCategory = prompts.filter((prompt) => enabledCategoryIds.has(prompt.categoryId));

  if (inCategory.length === 0) {
    throw new Error('No prompts available for the selected categories.');
  }

  const recent = new Set(recentQuestionIds);
  const fresh = inCategory.filter((prompt) => !recent.has(prompt.id));
  const pool = fresh.length > 0 ? fresh : inCategory;
  const index = Math.floor(Math.random() * pool.length);
  const picked = pool[index];

  if (!picked) {
    throw new Error('Failed to pick a Who Wrote It prompt.');
  }

  return picked;
}
