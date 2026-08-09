import {
  BARA_AL_SALAFA_GAME_ID,
  DRAW_GUESS_GAME_ID,
  FAST_ANSWER_GAME_ID,
  IMPOSTER_DRAW_GAME_ID,
} from '@wanasatna/shared';
import { baraAlSalafaRoundCategories } from './bara-al-salafa';
import type { GameRoundCategoriesConfig, RoundCategory } from './types';

const gameRoundCategoriesById: Record<string, GameRoundCategoriesConfig> = {
  [BARA_AL_SALAFA_GAME_ID]: baraAlSalafaRoundCategories,
  [DRAW_GUESS_GAME_ID]: baraAlSalafaRoundCategories,
  [IMPOSTER_DRAW_GAME_ID]: baraAlSalafaRoundCategories,
  [FAST_ANSWER_GAME_ID]: baraAlSalafaRoundCategories,
};

/** Returns category config for a game, or null when categories are unsupported. */
export function getGameRoundCategories(
  gameId: string | null | undefined,
): GameRoundCategoriesConfig | null {
  if (!gameId) {
    return null;
  }

  const config = gameRoundCategoriesById[gameId];

  if (!config || config.categories.length === 0) {
    return null;
  }

  return config;
}

export function getDefaultRoundCategoryId(gameId: string | null | undefined): string | null {
  return getGameRoundCategories(gameId)?.defaultCategoryId ?? null;
}

export function resolveRoundCategory(
  gameId: string | null | undefined,
  categoryId: string | null | undefined,
): RoundCategory | null {
  const config = getGameRoundCategories(gameId);

  if (!config) {
    return null;
  }

  const selected =
    config.categories.find((category) => category.id === categoryId) ??
    config.categories.find((category) => category.id === config.defaultCategoryId) ??
    config.categories[0] ??
    null;

  return selected;
}
