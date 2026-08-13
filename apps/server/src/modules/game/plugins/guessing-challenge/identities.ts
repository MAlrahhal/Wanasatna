import type {
  GameContentQuestion,
  GuessingChallengeIdentitySecret,
} from '@wanasatna/shared';
import {
  GUESSING_CHALLENGE_GAME_ID,
} from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { getRoomRoundCategory } from '../../runtime/round-category-store.js';
import { isCorrectAnswer } from '../fast-answer/answers.js';

export const GUESSING_CHALLENGE_RANDOM_CATEGORY_ID = 'random';
export const GUESSING_CHALLENGE_RANDOM_CATEGORY_LABEL = 'عشوائي';

export type GuessingChallengeCategoryOption = {
  id: string;
  label: string;
};

export type GuessingChallengeMatchCategory = {
  matchCategoryId: string;
  matchCategoryLabel: string;
};

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

function loadContent() {
  const content = getLoadedGameContent(GUESSING_CHALLENGE_GAME_ID);

  if (!content) {
    throw new Error('Guessing Challenge content is not loaded.');
  }

  return content;
}

export function getValidCategoryOptions(): GuessingChallengeCategoryOption[] {
  const content = loadContent();
  const questions = content.bundle.questions ?? [];

  return content.bundle.categories
    .filter((category) => category.enabled)
    .filter(
      (category) =>
        questions.filter((question) => question.categoryId === category.id).length >= 2,
    )
    .map((category) => ({ id: category.id, label: category.name }));
}

export function resolveMatchCategorySelection(roomId: string): GuessingChallengeMatchCategory {
  const options = getValidCategoryOptions();
  const requested = getRoomRoundCategory(roomId);

  if (requested && requested !== GUESSING_CHALLENGE_RANDOM_CATEGORY_ID) {
    const selected = options.find((option) => option.id === requested);
    if (selected) {
      return {
        matchCategoryId: selected.id,
        matchCategoryLabel: selected.label,
      };
    }
  }

  return {
    matchCategoryId: GUESSING_CHALLENGE_RANDOM_CATEGORY_ID,
    matchCategoryLabel: GUESSING_CHALLENGE_RANDOM_CATEGORY_LABEL,
  };
}

export function chooseRoundCategoryId(
  matchCategoryId: string,
  usedRoundCategoryIds: readonly string[],
  validCategoryIds: readonly string[],
  randomIndex: (exclusiveMax: number) => number = (exclusiveMax) =>
    Math.floor(Math.random() * exclusiveMax),
): string {
  if (validCategoryIds.length === 0) {
    throw new Error('Not enough identities available for Guessing Challenge.');
  }

  if (
    matchCategoryId !== GUESSING_CHALLENGE_RANDOM_CATEGORY_ID &&
    validCategoryIds.includes(matchCategoryId)
  ) {
    return matchCategoryId;
  }

  const used = new Set(usedRoundCategoryIds);
  const unused = validCategoryIds.filter((categoryId) => !used.has(categoryId));
  const candidates = unused.length > 0 ? unused : [...validCategoryIds];
  const rawIndex = randomIndex(candidates.length);
  const index = Math.max(0, Math.min(candidates.length - 1, rawIndex));
  return candidates[index]!;
}

export function pickRoundCategoryId(
  matchCategoryId: string,
  usedRoundCategoryIds: readonly string[],
): string {
  return chooseRoundCategoryId(
    matchCategoryId,
    usedRoundCategoryIds,
    getValidCategoryOptions().map((option) => option.id),
  );
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
  const preferred = shuffleInPlace([...fresh]);
  const fallback = shuffleInPlace(pool.filter((identity) => recent.has(identity.id)));
  const ordered = [...preferred, ...fallback];
  const first = ordered[0]!;
  const second = ordered.find((identity) => identity.id !== first.id);

  if (!second) {
    throw new Error('Failed to pick two distinct identities.');
  }

  return [first, second];
}

export function getIdentitiesForCategory(
  categoryId: string,
): GuessingChallengeIdentitySecret[] {
  const content = loadContent();

  return (content.bundle.questions ?? [])
    .filter((question) => question.categoryId === categoryId)
    .map(questionToIdentity);
}

export function pickReplacementIdentity(
  pool: readonly GuessingChallengeIdentitySecret[],
  options: {
    currentOpponentId: string;
    ownIdentityId: string;
    currentOpponentValue?: string;
    ownIdentityValue?: string;
    usedIdentityIds: readonly string[];
    recentIdentityIds?: readonly string[];
  },
): GuessingChallengeIdentitySecret | null {
  const used = new Set([
    ...options.usedIdentityIds,
    ...(options.recentIdentityIds ?? []),
  ]);
  const candidates = pool.filter(
    (identity) =>
      identity.id !== options.currentOpponentId &&
      identity.id !== options.ownIdentityId &&
      identity.value !== options.currentOpponentValue &&
      identity.value !== options.ownIdentityValue &&
      !used.has(identity.id),
  );

  const fallback = pool.filter(
    (identity) =>
      identity.id !== options.currentOpponentId && identity.id !== options.ownIdentityId,
  ).filter(
    (identity) =>
      identity.value !== options.currentOpponentValue &&
      identity.value !== options.ownIdentityValue,
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
