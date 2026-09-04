import type { GameContentBundle, GameContentWord } from '@wanasatna/shared';
import { normalizeCanonicalEntryKey, resolveEnabledCategoryIds } from '@wanasatna/shared';
import {
  getRoomContentHistory,
  recordRoomContentHistory,
} from './room-content-history.js';

export type ContentPickRandomIndex = (exclusiveMax: number) => number;

function defaultRandomIndex(exclusiveMax: number): number {
  if (exclusiveMax <= 0) {
    return 0;
  }
  return Math.floor(Math.random() * exclusiveMax);
}

export function contentKeyFromText(value: string): string {
  return normalizeCanonicalEntryKey(value) || value;
}

function pickUniform<T>(items: readonly T[], randomIndex: ContentPickRandomIndex): T {
  const index = Math.max(0, Math.min(items.length - 1, randomIndex(items.length)));
  return items[index]!;
}

/**
 * Prefer items not in the current match, then items not in room recent history.
 * If those pools are empty, fall back to the oldest/least-recent eligible items.
 * Never fails solely because recent history is full.
 */
export function pickWithLayeredHistory<T>(options: {
  items: readonly T[];
  matchKeysOf: (item: T) => readonly string[];
  roomKeyOf: (item: T) => string;
  matchUsedKeys: ReadonlySet<string>;
  roomRecentOldestFirst: readonly string[];
  randomIndex?: ContentPickRandomIndex;
}): T | null {
  const { items, matchKeysOf, roomKeyOf, matchUsedKeys, roomRecentOldestFirst } = options;
  const randomIndex = options.randomIndex ?? defaultRandomIndex;

  if (items.length === 0) {
    return null;
  }

  const matchFresh = items.filter(
    (item) => !matchKeysOf(item).some((key) => matchUsedKeys.has(key)),
  );
  const matchPool = matchFresh.length > 0 ? matchFresh : [...items];

  const roomRecent = new Set(roomRecentOldestFirst);
  const notRoomRecent = matchPool.filter((item) => !roomRecent.has(roomKeyOf(item)));
  if (notRoomRecent.length > 0) {
    return pickUniform(notRoomRecent, randomIndex);
  }

  const ageByKey = new Map(roomRecentOldestFirst.map((key, index) => [key, index]));
  let bestAge = Number.POSITIVE_INFINITY;
  const oldest: T[] = [];

  for (const item of matchPool) {
    const age = ageByKey.get(roomKeyOf(item)) ?? -1;
    if (age < bestAge) {
      bestAge = age;
      oldest.length = 0;
      oldest.push(item);
    } else if (age === bestAge) {
      oldest.push(item);
    }
  }

  return oldest.length > 0 ? pickUniform(oldest, randomIndex) : pickUniform(matchPool, randomIndex);
}

export function matchUsedKeysFromTexts(usedTexts: readonly string[]): Set<string> {
  const keys = new Set<string>();
  for (const text of usedTexts) {
    keys.add(text);
    keys.add(contentKeyFromText(text));
  }
  return keys;
}

function enabledCategoryIdsInBundleOrder(
  bundle: GameContentBundle,
  enabledCategoryIds?: string[],
): string[] {
  const active = resolveEnabledCategoryIds(bundle.categories, enabledCategoryIds);
  return bundle.categories
    .filter((category) => active.has(category.id))
    .filter((category) => bundle.words.some((word) => word.categoryId === category.id))
    .map((category) => category.id);
}

function categoryIdsUsedThisMatch(
  bundle: GameContentBundle,
  usedWordTexts: readonly string[],
): Set<string> {
  const used = new Set<string>();
  for (const text of usedWordTexts) {
    const word = bundle.words.find((entry) => entry.text === text);
    if (word) {
      used.add(word.categoryId);
    }
  }
  return used;
}

function wordMatchKeys(word: GameContentWord): string[] {
  return [word.text, contentKeyFromText(word.text)];
}

function isMatchFreshWord(
  word: GameContentWord,
  matchUsedKeys: ReadonlySet<string>,
): boolean {
  return !wordMatchKeys(word).some((key) => matchUsedKeys.has(key));
}

function categoryHasMatchFresh(
  bundle: GameContentBundle,
  categoryId: string,
  matchUsedKeys: ReadonlySet<string>,
): boolean {
  return bundle.words.some(
    (word) => word.categoryId === categoryId && isMatchFreshWord(word, matchUsedKeys),
  );
}

function categoryHasMatchAndRoomFresh(
  bundle: GameContentBundle,
  categoryId: string,
  matchUsedKeys: ReadonlySet<string>,
  roomRecent: ReadonlySet<string>,
): boolean {
  return bundle.words.some(
    (word) =>
      word.categoryId === categoryId &&
      isMatchFreshWord(word, matchUsedKeys) &&
      !roomRecent.has(contentKeyFromText(word.text)),
  );
}

function chooseCategoryFirstId(
  enabledIds: readonly string[],
  usedCategoryIds: ReadonlySet<string>,
  hasMatchFresh: (categoryId: string) => boolean,
  hasMatchAndRoomFresh: (categoryId: string) => boolean,
  randomIndex: ContentPickRandomIndex,
): string | null {
  if (enabledIds.length === 0) {
    return null;
  }

  const unused = enabledIds.filter((id) => !usedCategoryIds.has(id));
  const unusedRoomFresh = unused.filter(hasMatchAndRoomFresh);
  const usedRoomFresh = enabledIds.filter(
    (id) => usedCategoryIds.has(id) && hasMatchAndRoomFresh(id),
  );
  const unusedMatchFresh = unused.filter(hasMatchFresh);
  const usedMatchFresh = enabledIds.filter((id) => usedCategoryIds.has(id) && hasMatchFresh(id));

  const pool =
    unusedRoomFresh.length > 0
      ? unusedRoomFresh
      : usedRoomFresh.length > 0
        ? usedRoomFresh
        : unusedMatchFresh.length > 0
          ? unusedMatchFresh
          : usedMatchFresh.length > 0
            ? usedMatchFresh
            : enabledIds;

  return pickUniform(pool, randomIndex);
}

export function pickWordWithAntiRepetition(options: {
  bundle: GameContentBundle;
  enabledCategoryIds?: string[];
  lockedCategoryId?: string | null;
  usedWordTexts?: readonly string[];
  roomId?: string;
  historyKey: string;
  historyLimit?: number;
  randomIndex?: ContentPickRandomIndex;
}): GameContentWord | null {
  const usedWordTexts = options.usedWordTexts ?? [];
  const matchUsedKeys = matchUsedKeysFromTexts(usedWordTexts);
  const randomIndex = options.randomIndex ?? defaultRandomIndex;
  const roomRecent = options.roomId
    ? getRoomContentHistory(options.roomId, options.historyKey)
    : [];
  const roomRecentSet = new Set(roomRecent);

  const pickFromCategory = (categoryId: string): GameContentWord | null => {
    const words = options.bundle.words.filter((word) => word.categoryId === categoryId);
    return pickWithLayeredHistory({
      items: words,
      matchKeysOf: wordMatchKeys,
      roomKeyOf: (word) => contentKeyFromText(word.text),
      matchUsedKeys,
      roomRecentOldestFirst: roomRecent,
      randomIndex,
    });
  };

  const lockedCategoryId = options.lockedCategoryId ?? null;
  let picked: GameContentWord | null = null;

  if (lockedCategoryId) {
    picked = pickFromCategory(lockedCategoryId);
  } else {
    const enabledIds = enabledCategoryIdsInBundleOrder(
      options.bundle,
      options.enabledCategoryIds,
    );
    const usedCategoryIds = categoryIdsUsedThisMatch(options.bundle, usedWordTexts);
    const categoryId = chooseCategoryFirstId(
      enabledIds,
      usedCategoryIds,
      (id) => categoryHasMatchFresh(options.bundle, id, matchUsedKeys),
      (id) =>
        categoryHasMatchAndRoomFresh(options.bundle, id, matchUsedKeys, roomRecentSet),
      randomIndex,
    );

    if (categoryId) {
      picked = pickFromCategory(categoryId);
    }

    if (!picked) {
      for (const fallbackId of enabledIds) {
        if (fallbackId === categoryId) {
          continue;
        }
        picked = pickFromCategory(fallbackId);
        if (picked) {
          break;
        }
      }
    }
  }

  if (picked && options.roomId) {
    recordRoomContentHistory(
      options.roomId,
      options.historyKey,
      contentKeyFromText(picked.text),
      options.historyLimit,
    );
  }

  return picked;
}
