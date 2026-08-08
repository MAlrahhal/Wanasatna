import type { GameContentWord } from '@wanasatna/shared';
import { DRAW_GUESS_GAME_ID, pickRandomWordFromCategories } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { resolveEnabledCategoryFilter } from '../../runtime/round-category-store.js';

export function pickDrawGuessWord(roomId: string): GameContentWord {
  const content = getLoadedGameContent(DRAW_GUESS_GAME_ID);

  if (!content) {
    throw new Error('Draw & Guess content is not loaded.');
  }

  const wordEntry = pickRandomWordFromCategories(
    content.bundle,
    resolveEnabledCategoryFilter(roomId) ?? content.settings.enabledCategories,
  );

  if (!wordEntry) {
    throw new Error('No words available for the selected categories.');
  }

  return wordEntry;
}

/** Normalize Arabic guesses for trim + case-insensitive + common letter variants. */
export function normalizeGuessText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u0640/g, '')
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

export function isCorrectGuess(guess: string, secretWord: string): boolean {
  return normalizeGuessText(guess) === normalizeGuessText(secretWord);
}
