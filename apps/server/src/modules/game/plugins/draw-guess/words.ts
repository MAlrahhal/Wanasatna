import type { GameContentWord } from '@wanasatna/shared';
import { DRAW_GUESS_GAME_ID, normalizeTextAnswer } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { pickWordWithAntiRepetition } from '../../runtime/content-selection.js';
import {
  ROOM_CONTENT_HISTORY_KEY,
  ROOM_CONTENT_HISTORY_LIMIT,
} from '../../runtime/room-content-history.js';
import { resolveEnabledCategoryFilter } from '../../runtime/round-category-store.js';

export function pickDrawGuessWord(
  roomId: string,
  excludeTexts: readonly string[] = [],
): GameContentWord {
  const content = getLoadedGameContent(DRAW_GUESS_GAME_ID);

  if (!content) {
    throw new Error('Draw & Guess content is not loaded.');
  }

  const lockedFilter = resolveEnabledCategoryFilter(roomId);
  const wordEntry = pickWordWithAntiRepetition({
    bundle: content.bundle,
    enabledCategoryIds: lockedFilter ?? content.settings.enabledCategories,
    lockedCategoryId: lockedFilter?.[0] ?? null,
    usedWordTexts: excludeTexts,
    roomId,
    historyKey: ROOM_CONTENT_HISTORY_KEY.DRAWABLE_WORDS,
    historyLimit: ROOM_CONTENT_HISTORY_LIMIT[ROOM_CONTENT_HISTORY_KEY.DRAWABLE_WORDS],
  });

  if (!wordEntry) {
    throw new Error('No words available for the selected categories.');
  }

  return wordEntry;
}

export const normalizeGuessText = normalizeTextAnswer;

export function isCorrectGuess(
  guess: string,
  secretWord: string,
  aliases: readonly string[] = [],
): boolean {
  const normalizedGuess = normalizeGuessText(guess);
  return [secretWord, ...aliases].some((answer) => normalizeGuessText(answer) === normalizedGuess);
}

export function getDrawGuessAliases(secretWord: string): string[] {
  const content = getLoadedGameContent(DRAW_GUESS_GAME_ID);
  const word = content?.bundle.words.find((entry) => entry.text === secretWord);
  return word?.aliases ?? [];
}

export function getDrawGuessWordId(secretWord: string): string | null {
  const content = getLoadedGameContent(DRAW_GUESS_GAME_ID);
  return content?.bundle.words.find((entry) => entry.text === secretWord)?.id ?? null;
}
