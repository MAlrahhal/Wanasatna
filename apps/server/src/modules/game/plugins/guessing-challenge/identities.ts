import type {
  GameContentQuestion,
  GuessingChallengeIdentitySecret,
} from '@wanasatna/shared';
import {
  GUESSING_CHALLENGE_GAME_ID,
} from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { getRoomRoundCategory } from '../../runtime/round-category-store.js';
import { contentKeyFromText, pickWithLayeredHistory } from '../../runtime/content-selection.js';
import {
  ROOM_CONTENT_HISTORY_KEY,
  ROOM_CONTENT_HISTORY_LIMIT,
  getRoomContentHistory,
  recordRoomContentHistory,
} from '../../runtime/room-content-history.js';
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

function identityMatchKeys(identity: GuessingChallengeIdentitySecret): string[] {
  return [identity.id, contentKeyFromText(identity.value)];
}

function matchUsedKeysFromIdentities(
  pool: readonly GuessingChallengeIdentitySecret[],
  recentIdentityIds: readonly string[],
): Set<string> {
  const recent = new Set(recentIdentityIds);
  const keys = new Set<string>(recentIdentityIds);

  for (const identity of pool) {
    if (recent.has(identity.id)) {
      keys.add(contentKeyFromText(identity.value));
    }
  }

  const content = getLoadedGameContent(GUESSING_CHALLENGE_GAME_ID);
  for (const question of content?.bundle.questions ?? []) {
    if (recent.has(question.id)) {
      keys.add(contentKeyFromText(question.question.trim()));
    }
  }

  return keys;
}

export function pickTwoIdentities(
  pool: readonly GuessingChallengeIdentitySecret[],
  recentIdentityIds: readonly string[],
  roomId?: string,
): [GuessingChallengeIdentitySecret, GuessingChallengeIdentitySecret] {
  if (pool.length < 2) {
    throw new Error('Need at least two identities.');
  }

  const matchUsedKeys = matchUsedKeysFromIdentities(pool, recentIdentityIds);
  const roomRecent = roomId
    ? getRoomContentHistory(roomId, ROOM_CONTENT_HISTORY_KEY.GUESSING_CHALLENGE)
    : [];

  const first = pickWithLayeredHistory({
    items: pool,
    matchKeysOf: identityMatchKeys,
    roomKeyOf: (identity) => identity.id,
    matchUsedKeys,
    roomRecentOldestFirst: roomRecent,
  });

  if (!first) {
    throw new Error('Failed to pick two distinct identities.');
  }

  const firstCanonical = contentKeyFromText(first.value);
  const remaining = pool.filter(
    (identity) =>
      identity.id !== first.id && contentKeyFromText(identity.value) !== firstCanonical,
  );

  const second = pickWithLayeredHistory({
    items: remaining,
    matchKeysOf: identityMatchKeys,
    roomKeyOf: (identity) => identity.id,
    matchUsedKeys,
    roomRecentOldestFirst: roomRecent,
  });

  if (!second) {
    throw new Error('Failed to pick two distinct identities.');
  }

  if (roomId) {
    recordRoomContentHistory(
      roomId,
      ROOM_CONTENT_HISTORY_KEY.GUESSING_CHALLENGE,
      first.id,
      ROOM_CONTENT_HISTORY_LIMIT[ROOM_CONTENT_HISTORY_KEY.GUESSING_CHALLENGE],
    );
    recordRoomContentHistory(
      roomId,
      ROOM_CONTENT_HISTORY_KEY.GUESSING_CHALLENGE,
      second.id,
      ROOM_CONTENT_HISTORY_LIMIT[ROOM_CONTENT_HISTORY_KEY.GUESSING_CHALLENGE],
    );
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
    roomId?: string;
  },
): GuessingChallengeIdentitySecret | null {
  const hardExcluded = pool.filter(
    (identity) =>
      identity.id !== options.currentOpponentId &&
      identity.id !== options.ownIdentityId &&
      identity.value !== options.currentOpponentValue &&
      identity.value !== options.ownIdentityValue,
  );

  if (hardExcluded.length === 0) {
    return null;
  }

  const recentIdentityIds = [
    ...options.usedIdentityIds,
    ...(options.recentIdentityIds ?? []),
  ];
  const replacement = pickWithLayeredHistory({
    items: hardExcluded,
    matchKeysOf: identityMatchKeys,
    roomKeyOf: (identity) => identity.id,
    matchUsedKeys: matchUsedKeysFromIdentities(pool, recentIdentityIds),
    roomRecentOldestFirst: options.roomId
      ? getRoomContentHistory(options.roomId, ROOM_CONTENT_HISTORY_KEY.GUESSING_CHALLENGE)
      : [],
  });

  if (replacement && options.roomId) {
    recordRoomContentHistory(
      options.roomId,
      ROOM_CONTENT_HISTORY_KEY.GUESSING_CHALLENGE,
      replacement.id,
      ROOM_CONTENT_HISTORY_LIMIT[ROOM_CONTENT_HISTORY_KEY.GUESSING_CHALLENGE],
    );
  }

  return replacement;
}

export function identityMatchesGuess(
  identity: GuessingChallengeIdentitySecret,
  guess: string,
): boolean {
  return isCorrectAnswer(guess, identity.acceptedAnswers);
}

export { isCorrectAnswer };
