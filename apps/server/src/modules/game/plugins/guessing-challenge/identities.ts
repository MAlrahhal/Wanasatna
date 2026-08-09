import type {
  GameContentQuestion,
  GuessingChallengeIdentitySecret,
} from '@wanasatna/shared';
import {
  GUESSING_CHALLENGE_GAME_ID,
  resolveEnabledCategoryIds,
} from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { resolveEnabledCategoryFilter } from '../../runtime/round-category-store.js';
import { isCorrectAnswer } from '../fast-answer/answers.js';

export function questionToIdentity(question: GameContentQuestion): GuessingChallengeIdentitySecret {
  return {
    id: question.id,
    categoryId: question.categoryId,
    type: 'text',
    value: question.question.trim(),
    imageUrl: null,
    acceptedAnswers: question.acceptedAnswers,
  };
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = items[index]!;
    items[index] = items[swapIndex]!;
    items[swapIndex] = current;
  }
  return items;
}

export function resolveCategoryPool(
  roomId: string,
): { categoryId: string; identities: GuessingChallengeIdentitySecret[] } {
  const content = getLoadedGameContent(GUESSING_CHALLENGE_GAME_ID);

  if (!content) {
    throw new Error('Guessing Challenge content is not loaded.');
  }

  const questions = content.bundle.questions ?? [];
  const filter = resolveEnabledCategoryFilter(roomId);
  const enabledCategoryIds = resolveEnabledCategoryIds(
    content.bundle.categories,
    filter ?? content.settings.enabledCategories,
  );

  if (filter && filter.length === 1) {
    const categoryId = filter[0]!;
    const identities = questions
      .filter((question) => question.categoryId === categoryId)
      .map(questionToIdentity);

    if (identities.length < 2) {
      throw new Error('Not enough identities in the selected category.');
    }

    return { categoryId, identities };
  }

  const categoryIds = shuffleInPlace([...enabledCategoryIds]);

  for (const categoryId of categoryIds) {
    const identities = questions
      .filter((question) => question.categoryId === categoryId)
      .map(questionToIdentity);

    if (identities.length >= 2) {
      return { categoryId, identities };
    }
  }

  throw new Error('Not enough identities available for Guessing Challenge.');
}

export function pickTwoIdentities(
  pool: readonly GuessingChallengeIdentitySecret[],
  recentIdentityIds: readonly string[],
): [GuessingChallengeIdentitySecret, GuessingChallengeIdentitySecret] {
  if (pool.length < 2) {
    throw new Error('Need at least two identities.');
  }

  const recent = new Set(recentIdentityIds);
  const fresh = pool.filter((identity) => !recent.has(identity.id));
  const source = fresh.length >= 2 ? fresh : [...pool];
  const shuffled = shuffleInPlace([...source]);
  const first = shuffled[0]!;
  const second = shuffled.find((identity) => identity.id !== first.id);

  if (!second) {
    throw new Error('Failed to pick two distinct identities.');
  }

  return [first, second];
}

export function getIdentitiesForCategory(
  categoryId: string,
): GuessingChallengeIdentitySecret[] {
  const content = getLoadedGameContent(GUESSING_CHALLENGE_GAME_ID);

  if (!content) {
    return [];
  }

  return (content.bundle.questions ?? [])
    .filter((question) => question.categoryId === categoryId)
    .map(questionToIdentity);
}

export function pickReplacementIdentity(
  pool: readonly GuessingChallengeIdentitySecret[],
  options: {
    currentOpponentId: string;
    ownIdentityId: string;
    usedIdentityIds: readonly string[];
  },
): GuessingChallengeIdentitySecret | null {
  const used = new Set(options.usedIdentityIds);
  const candidates = pool.filter(
    (identity) =>
      identity.id !== options.currentOpponentId &&
      identity.id !== options.ownIdentityId &&
      !used.has(identity.id),
  );

  const fallback = pool.filter(
    (identity) =>
      identity.id !== options.currentOpponentId && identity.id !== options.ownIdentityId,
  );

  const source = candidates.length > 0 ? candidates : fallback;

  if (source.length === 0) {
    return null;
  }

  return source[Math.floor(Math.random() * source.length)] ?? null;
}

export function identityMatchesGuess(
  identity: GuessingChallengeIdentitySecret,
  guess: string,
): boolean {
  return isCorrectAnswer(guess, identity.acceptedAnswers);
}

export { isCorrectAnswer };
