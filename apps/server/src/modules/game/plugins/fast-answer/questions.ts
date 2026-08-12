import type { GameContentQuestion } from '@wanasatna/shared';
import { FAST_ANSWER_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { getRoomRoundCategory } from '../../runtime/round-category-store.js';

export const FAST_ANSWER_RANDOM_CATEGORY_ID = 'random';
export const FAST_ANSWER_RANDOM_CATEGORY_LABEL = 'عشوائي';

export type FastAnswerCategoryOption = {
  id: string;
  label: string;
};

export type ResolvedMatchCategory = {
  /** Lobby selection: specific id or `random`. */
  matchCategoryId: string;
  /** Public label shown in header for the whole match. */
  matchCategoryLabel: string;
};

function categoriesWithQuestions(
  questions: readonly GameContentQuestion[],
  categories: readonly { id: string; name: string; enabled: boolean }[],
): FastAnswerCategoryOption[] {
  return categories
    .filter((category) => category.enabled)
    .filter((category) => questions.some((question) => question.categoryId === category.id))
    .map((category) => ({ id: category.id, label: category.name }));
}

function loadCategoryPool(): FastAnswerCategoryOption[] {
  const content = getLoadedGameContent(FAST_ANSWER_GAME_ID);

  if (!content) {
    throw new Error('Fast Answer content is not loaded.');
  }

  const questions = content.bundle.questions ?? [];
  const pool = categoriesWithQuestions(questions, content.bundle.categories);

  if (pool.length === 0) {
    throw new Error('No Fast Answer categories with questions are available.');
  }

  return pool;
}

/**
 * Resolve lobby match category selection.
 * Specific valid id → lock that category for all rounds.
 * Missing / random / invalid → public mode stays `عشوائي` (per-round internal pick later).
 */
export function resolveMatchCategorySelection(roomId: string): ResolvedMatchCategory {
  const pool = loadCategoryPool();
  const requested = getRoomRoundCategory(roomId);

  if (requested && requested !== FAST_ANSWER_RANDOM_CATEGORY_ID) {
    const matched = pool.find((category) => category.id === requested);
    if (matched) {
      return {
        matchCategoryId: matched.id,
        matchCategoryLabel: matched.label,
      };
    }
  }

  return {
    matchCategoryId: FAST_ANSWER_RANDOM_CATEGORY_ID,
    matchCategoryLabel: FAST_ANSWER_RANDOM_CATEGORY_LABEL,
  };
}

/**
 * Pure category picker for a round (testable).
 * Fixed match → locked id when present in pool.
 * Random → unused first; reuse only after pool exhausted.
 */
export function chooseRoundCategoryId(
  matchCategoryId: string,
  usedRoundCategoryIds: readonly string[],
  poolIds: readonly string[],
  randomIndex: (exclusiveMax: number) => number = (exclusiveMax) =>
    Math.floor(Math.random() * exclusiveMax),
): string {
  if (poolIds.length === 0) {
    throw new Error('No Fast Answer categories available.');
  }

  if (matchCategoryId !== FAST_ANSWER_RANDOM_CATEGORY_ID && poolIds.includes(matchCategoryId)) {
    return matchCategoryId;
  }

  const used = new Set(usedRoundCategoryIds);
  const unused = poolIds.filter((id) => !used.has(id));
  const candidates = unused.length > 0 ? unused : [...poolIds];
  const index = Math.max(0, Math.min(candidates.length - 1, randomIndex(candidates.length)));
  return candidates[index]!;
}

/**
 * Pick the actual category used to select this round's question.
 * Fixed match → always the locked id.
 * Random match → unused categories first, then reuse after pool exhausted.
 */
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

export function pickFastAnswerQuestion(
  categoryId: string,
  recentQuestionIds: readonly string[],
): GameContentQuestion {
  const content = getLoadedGameContent(FAST_ANSWER_GAME_ID);

  if (!content) {
    throw new Error('Fast Answer content is not loaded.');
  }

  const questions = content.bundle.questions ?? [];
  const inCategory = questions.filter((question) => question.categoryId === categoryId);

  if (inCategory.length === 0) {
    throw new Error('No questions available for the selected Fast Answer category.');
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

/** Test helper: list valid category ids with questions. */
export function listFastAnswerCategoryIdsWithQuestions(): string[] {
  return loadCategoryPool().map((category) => category.id);
}
