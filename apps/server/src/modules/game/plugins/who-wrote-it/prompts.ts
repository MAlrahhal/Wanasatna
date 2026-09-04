import type { GameContentWord } from '@wanasatna/shared';
import { WHO_WROTE_IT_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { contentKeyFromText, pickWithLayeredHistory } from '../../runtime/content-selection.js';
import {
  ROOM_CONTENT_HISTORY_KEY,
  ROOM_CONTENT_HISTORY_LIMIT,
  getRoomContentHistory,
  recordRoomContentHistory,
} from '../../runtime/room-content-history.js';
import { getRoomRoundCategory } from '../../runtime/round-category-store.js';

export const WHO_WROTE_IT_RANDOM_CATEGORY_ID = 'random';
export const WHO_WROTE_IT_RANDOM_CATEGORY_LABEL = 'عشوائي';

export type WhoWroteItCategoryOption = {
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
): WhoWroteItCategoryOption[] {
  return categories
    .filter((category) => category.enabled)
    .filter((category) => prompts.some((prompt) => prompt.categoryId === category.id))
    .map((category) => ({ id: category.id, label: category.name }));
}

function loadCategoryPool(): WhoWroteItCategoryOption[] {
  const content = getLoadedGameContent(WHO_WROTE_IT_GAME_ID);

  if (!content) {
    throw new Error('Who Wrote It content is not loaded.');
  }

  const prompts = content.bundle.words ?? [];
  const pool = categoriesWithPrompts(prompts, content.bundle.categories);

  if (pool.length === 0) {
    throw new Error('No Who Wrote It categories with prompts are available.');
  }

  return pool;
}

export function resolveMatchCategorySelection(roomId: string): ResolvedMatchCategory {
  const pool = loadCategoryPool();
  const requested = getRoomRoundCategory(roomId);

  if (requested && requested !== WHO_WROTE_IT_RANDOM_CATEGORY_ID) {
    const matched = pool.find((category) => category.id === requested);
    if (matched) {
      return {
        matchCategoryId: matched.id,
        matchCategoryLabel: matched.label,
      };
    }
  }

  return {
    matchCategoryId: WHO_WROTE_IT_RANDOM_CATEGORY_ID,
    matchCategoryLabel: WHO_WROTE_IT_RANDOM_CATEGORY_LABEL,
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
    throw new Error('No Who Wrote It categories available.');
  }

  if (matchCategoryId !== WHO_WROTE_IT_RANDOM_CATEGORY_ID && poolIds.includes(matchCategoryId)) {
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

function promptMatchKeys(prompt: GameContentWord): string[] {
  return [prompt.id, contentKeyFromText(prompt.text)];
}

function matchUsedKeysFromPrompts(
  prompts: readonly GameContentWord[],
  recentQuestionIds: readonly string[],
): Set<string> {
  const recent = new Set(recentQuestionIds);
  const keys = new Set<string>(recentQuestionIds);
  for (const prompt of prompts) {
    if (recent.has(prompt.id)) {
      keys.add(contentKeyFromText(prompt.text));
    }
  }
  return keys;
}

export function pickWhoWroteItPrompt(
  categoryId: string,
  recentQuestionIds: readonly string[],
  roomId?: string,
): GameContentWord {
  const content = getLoadedGameContent(WHO_WROTE_IT_GAME_ID);

  if (!content) {
    throw new Error('Who Wrote It content is not loaded.');
  }

  const prompts = content.bundle.words ?? [];
  const inCategory = prompts.filter((prompt) => prompt.categoryId === categoryId);

  if (inCategory.length === 0) {
    throw new Error('No prompts available for the selected Who Wrote It category.');
  }

  const picked = pickWithLayeredHistory({
    items: inCategory,
    matchKeysOf: promptMatchKeys,
    roomKeyOf: (prompt) => prompt.id,
    matchUsedKeys: matchUsedKeysFromPrompts(prompts, recentQuestionIds),
    roomRecentOldestFirst: roomId
      ? getRoomContentHistory(roomId, ROOM_CONTENT_HISTORY_KEY.WHO_WROTE_IT)
      : [],
  });

  if (!picked) {
    throw new Error('Failed to pick a Who Wrote It prompt.');
  }

  if (roomId) {
    recordRoomContentHistory(
      roomId,
      ROOM_CONTENT_HISTORY_KEY.WHO_WROTE_IT,
      picked.id,
      ROOM_CONTENT_HISTORY_LIMIT[ROOM_CONTENT_HISTORY_KEY.WHO_WROTE_IT],
    );
  }

  return picked;
}
