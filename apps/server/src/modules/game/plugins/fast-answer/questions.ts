import type { GameContentQuestion } from '@wanasatna/shared';
import { FAST_ANSWER_GAME_ID, resolveEnabledCategoryIds } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { resolveEnabledCategoryFilter } from '../../runtime/round-category-store.js';

export function pickFastAnswerQuestion(
  roomId: string,
  recentQuestionIds: readonly string[],
): GameContentQuestion {
  const content = getLoadedGameContent(FAST_ANSWER_GAME_ID);

  if (!content) {
    throw new Error('Fast Answer content is not loaded.');
  }

  const questions = content.bundle.questions ?? [];
  const enabledCategoryIds = resolveEnabledCategoryIds(
    content.bundle.categories,
    resolveEnabledCategoryFilter(roomId) ?? content.settings.enabledCategories,
  );

  const inCategory = questions.filter((question) =>
    enabledCategoryIds.has(question.categoryId),
  );

  if (inCategory.length === 0) {
    throw new Error('No questions available for the selected categories.');
  }

  const recent = new Set(recentQuestionIds);
  const fresh = inCategory.filter((question) => !recent.has(question.id));
  const pool = fresh.length > 0 ? fresh : inCategory;
  const index = Math.floor(Math.random() * pool.length);
  const picked = pool[index];

  if (!picked) {
    throw new Error('Failed to pick a Fast Answer question.');
  }

  return picked;
}
