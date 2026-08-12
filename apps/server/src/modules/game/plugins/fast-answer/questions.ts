import type { GameContentQuestion } from '@wanasatna/shared';
import { FAST_ANSWER_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { getRoomRoundCategory } from '../../runtime/round-category-store.js';

export type LockedFastAnswerCategory = {
  id: string;
  label: string;
};

function categoriesWithQuestions(
  questions: readonly GameContentQuestion[],
  categories: readonly { id: string; name: string; enabled: boolean }[],
): LockedFastAnswerCategory[] {
  return categories
    .filter((category) => category.enabled)
    .filter((category) => questions.some((question) => question.categoryId === category.id))
    .map((category) => ({ id: category.id, label: category.name }));
}

/**
 * Resolve and lock one category at match start.
 * Lobby `random` / missing → pick one enabled category with questions.
 * Invalid id → same safe fallback (first enabled-with-questions).
 */
export function resolveLockedFastAnswerCategory(roomId: string): LockedFastAnswerCategory {
  const content = getLoadedGameContent(FAST_ANSWER_GAME_ID);

  if (!content) {
    throw new Error('Fast Answer content is not loaded.');
  }

  const questions = content.bundle.questions ?? [];
  const pool = categoriesWithQuestions(questions, content.bundle.categories);

  if (pool.length === 0) {
    throw new Error('No Fast Answer categories with questions are available.');
  }

  const requested = getRoomRoundCategory(roomId);
  const matched = requested ? pool.find((category) => category.id === requested) : undefined;

  if (matched) {
    return matched;
  }

  // Random or invalid: pick one stable random category for the whole match.
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? pool[0]!;
}

export function pickFastAnswerQuestion(
  lockedCategoryId: string,
  recentQuestionIds: readonly string[],
): GameContentQuestion {
  const content = getLoadedGameContent(FAST_ANSWER_GAME_ID);

  if (!content) {
    throw new Error('Fast Answer content is not loaded.');
  }

  const questions = content.bundle.questions ?? [];
  const inCategory = questions.filter((question) => question.categoryId === lockedCategoryId);

  if (inCategory.length === 0) {
    throw new Error('No questions available for the locked Fast Answer category.');
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
