import {
  ARABIC_CANONICAL_CATEGORY_IDS,
  LATIN_CANONICAL_CATEGORY_IDS,
  VIRTUAL_RANDOM_CATEGORY_ID,
  canonicalHasArabicScript,
  canonicalHasLatinScript,
  getGameContentCategoryContract,
} from './categories.js';
import { normalizeAcceptedAnswerKey, normalizeCanonicalEntryKey } from './normalize.js';
import type { GameContentSettings } from './settings.js';
import type {
  ContentValidationResult,
  GameContentBundle,
  GameContentCategory,
  GameContentQuestion,
} from './types.js';
import { resolveEnabledCategoryIds } from './word-picker.js';

/** Extreme accidental-content guards. Style targets are documented separately. */
export const CONTENT_MAX_WORD_TEXT_LENGTH = 160;
export const CONTENT_MAX_QUESTION_TEXT_LENGTH = 160;
export const CONTENT_MAX_ACCEPTED_ANSWER_LENGTH = 80;

const GUESSING_CHALLENGE_GAME_ID = 'guessing-challenge';

function failure(errors: string[]): ContentValidationResult {
  return { valid: false, errors };
}

function scoped(gameId: string, message: string): string {
  return gameId ? `[${gameId}] ${message}` : message;
}

function collectDuplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  }

  return [...duplicates];
}

export function validatePlayerCount(
  connectedPlayers: number,
  settings: Pick<GameContentSettings, 'minPlayers' | 'maxPlayers'>,
): ContentValidationResult {
  const errors: string[] = [];

  if (connectedPlayers < settings.minPlayers) {
    errors.push(`At least ${settings.minPlayers} connected players are required.`);
  }

  if (connectedPlayers > settings.maxPlayers) {
    errors.push(`No more than ${settings.maxPlayers} connected players are allowed.`);
  }

  return errors.length > 0 ? failure(errors) : { valid: true };
}

export function validateEnabledCategories(
  bundle: GameContentBundle,
  settings: Pick<GameContentSettings, 'enabledCategories'>,
): ContentValidationResult {
  const enabledCategoryIds = resolveEnabledCategoryIds(
    bundle.categories,
    settings.enabledCategories,
  );

  if (enabledCategoryIds.size === 0) {
    return failure(['At least one enabled category is required.']);
  }

  const wordsInEnabledCategories = bundle.words.filter((word) =>
    enabledCategoryIds.has(word.categoryId),
  );
  const questionsInEnabledCategories = (bundle.questions ?? []).filter((question) =>
    enabledCategoryIds.has(question.categoryId),
  );

  if (wordsInEnabledCategories.length === 0 && questionsInEnabledCategories.length === 0) {
    return failure(['At least one word or question is required in the enabled categories.']);
  }

  return { valid: true };
}

export function validateCategoryDefinitions(
  categories: GameContentCategory[],
  gameId = '',
): ContentValidationResult {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const category of categories) {
    if (!category.id.trim()) {
      errors.push(scoped(gameId, 'Category id must not be empty.'));
    }

    if (category.id === VIRTUAL_RANDOM_CATEGORY_ID) {
      errors.push(
        scoped(gameId, `"${VIRTUAL_RANDOM_CATEGORY_ID}" is a virtual UI option, not stored content.`),
      );
    }

    if (seenIds.has(category.id)) {
      errors.push(scoped(gameId, `Duplicate category id: ${category.id}`));
    }

    seenIds.add(category.id);

    if (!category.name.trim()) {
      errors.push(scoped(gameId, `Category "${category.id}" must have a name.`));
    }
  }

  return errors.length > 0 ? failure(errors) : { valid: true };
}

const ARABIC_CANONICAL_CATEGORY_SET = new Set<string>(ARABIC_CANONICAL_CATEGORY_IDS);
const LATIN_CANONICAL_CATEGORY_SET = new Set<string>(LATIN_CANONICAL_CATEGORY_IDS);

function validateGameCategoryContract(bundle: GameContentBundle, errors: string[]): void {
  const contract = getGameContentCategoryContract(bundle.gameId);

  if (!contract) {
    return;
  }

  const actualIds = bundle.categories.map((category) => category.id);
  const expected: string[] = [...contract.ids];
  const actualSet = new Set<string>(actualIds);
  const expectedSet = new Set<string>(expected);

  const missing = expected.filter((id) => !actualSet.has(id));
  const extra = actualIds.filter((id) => !expectedSet.has(id));

  if (missing.length > 0 || extra.length > 0) {
    errors.push(
      scoped(
        bundle.gameId,
        `category pack must be exactly: ${expected.join(', ')}` +
          `${missing.length > 0 ? ` (missing: ${missing.join(', ')})` : ''}` +
          `${extra.length > 0 ? ` (unexpected: ${extra.join(', ')})` : ''}`,
      ),
    );
  }

  for (const category of bundle.categories) {
    const expectedName = contract.labels[category.id];

    if (expectedName && category.name.trim() !== expectedName) {
      errors.push(
        scoped(
          bundle.gameId,
          `category "${category.id}" name must be "${expectedName}" (got "${category.name}").`,
        ),
      );
    }
  }
}

function validateCanonicalDisplayLanguage(bundle: GameContentBundle, errors: string[]): void {
  if (!getGameContentCategoryContract(bundle.gameId)) {
    return;
  }

  for (const word of bundle.words) {
    validateDisplayScript(bundle.gameId, word.categoryId, `Word "${word.id}"`, word.text, errors);
  }

  for (const question of bundle.questions ?? []) {
    const display =
      bundle.gameId === GUESSING_CHALLENGE_GAME_ID
        ? question.question
        : (question.acceptedAnswers?.[0]?.trim() || question.question);

    validateDisplayScript(
      bundle.gameId,
      question.categoryId,
      `Question "${question.id}"`,
      display,
      errors,
    );
  }
}

function validateDisplayScript(
  gameId: string,
  categoryId: string,
  label: string,
  display: string,
  errors: string[],
): void {
  if (!display) {
    return;
  }

  if (LATIN_CANONICAL_CATEGORY_SET.has(categoryId) && !canonicalHasLatinScript(display)) {
    errors.push(
      scoped(gameId, `${label} canonical display in "${categoryId}" must use a Latin-script name.`),
    );
  }

  if (ARABIC_CANONICAL_CATEGORY_SET.has(categoryId) && !canonicalHasArabicScript(display)) {
    errors.push(scoped(gameId, `${label} canonical display in "${categoryId}" must use Arabic.`));
  }
}

function validateAcceptedAnswers(
  bundle: GameContentBundle,
  question: GameContentQuestion,
  errors: string[],
): void {
  const answers = question.acceptedAnswers ?? [];

  if (answers.length === 0) {
    errors.push(
      scoped(bundle.gameId, `Question "${question.id}" must have at least one accepted answer.`),
    );
    return;
  }

  const normalizedKeys: string[] = [];

  for (const [index, answer] of answers.entries()) {
    if (!answer.trim()) {
      errors.push(
        scoped(
          bundle.gameId,
          `Question "${question.id}" accepted answer #${index + 1} must have text.`,
        ),
      );
      continue;
    }

    if (answer.length > CONTENT_MAX_ACCEPTED_ANSWER_LENGTH) {
      errors.push(
        scoped(
          bundle.gameId,
          `Question "${question.id}" accepted answer #${index + 1} exceeds ${CONTENT_MAX_ACCEPTED_ANSWER_LENGTH} characters.`,
        ),
      );
    }

    const key = normalizeAcceptedAnswerKey(answer);

    if (!key) {
      errors.push(
        scoped(
          bundle.gameId,
          `Question "${question.id}" accepted answer #${index + 1} is empty after normalization.`,
        ),
      );
      continue;
    }

    normalizedKeys.push(key);
  }

  const duplicateKeys = collectDuplicateValues(normalizedKeys);

  for (const key of duplicateKeys) {
    errors.push(
      scoped(
        bundle.gameId,
        `Question "${question.id}" has duplicate accepted answers after normalization: ${key}`,
      ),
    );
  }

  if (bundle.gameId === GUESSING_CHALLENGE_GAME_ID) {
    const canonicalKey = normalizeAcceptedAnswerKey(question.question);

    if (canonicalKey && !normalizedKeys.includes(canonicalKey)) {
      errors.push(
        scoped(
          bundle.gameId,
          `Question "${question.id}" canonical text is not an accepted answer.`,
        ),
      );
    }
  }
}

function validateGuessingChallengeAliasCollisions(
  bundle: GameContentBundle,
  errors: string[],
): void {
  if (bundle.gameId !== GUESSING_CHALLENGE_GAME_ID) {
    return;
  }

  const owners = new Map<string, string>();

  for (const question of bundle.questions ?? []) {
    const seenForItem = new Set<string>();

    for (const answer of question.acceptedAnswers ?? []) {
      const key = normalizeAcceptedAnswerKey(answer);

      if (!key || seenForItem.has(key)) {
        continue;
      }

      seenForItem.add(key);

      const existing = owners.get(key);

      if (existing && existing !== question.id) {
        errors.push(
          scoped(
            bundle.gameId,
            `Accepted-answer collision on "${key}" between "${existing}" and "${question.id}"`,
          ),
        );
        continue;
      }

      owners.set(key, question.id);
    }
  }
}

function validateCanonicalTextDuplicates(bundle: GameContentBundle, errors: string[]): void {
  const wordKeys = new Map<string, string[]>();

  for (const word of bundle.words) {
    const key = normalizeCanonicalEntryKey(word.text);

    if (!key) {
      continue;
    }

    const ids = wordKeys.get(key) ?? [];
    ids.push(word.id);
    wordKeys.set(key, ids);
  }

  for (const [key, ids] of wordKeys) {
    if (ids.length > 1) {
      errors.push(
        scoped(
          bundle.gameId,
          `Duplicate canonical word text: ${key} (word ids: ${ids.join(', ')})`,
        ),
      );
    }
  }

  const questionKeys = new Map<string, string[]>();

  for (const question of bundle.questions ?? []) {
    const key = normalizeCanonicalEntryKey(question.question);

    if (!key) {
      continue;
    }

    const ids = questionKeys.get(key) ?? [];
    ids.push(question.id);
    questionKeys.set(key, ids);
  }

  for (const [key, ids] of questionKeys) {
    if (ids.length > 1) {
      errors.push(
        scoped(
          bundle.gameId,
          `Duplicate canonical question text: ${key} (question ids: ${ids.join(', ')})`,
        ),
      );
    }
  }
}

export function validateContentBundle(bundle: GameContentBundle): ContentValidationResult {
  const errors: string[] = [];
  const gameId = bundle.gameId;

  const categoryValidation = validateCategoryDefinitions(bundle.categories, gameId);
  if (!categoryValidation.valid) {
    errors.push(...categoryValidation.errors);
  }

  validateGameCategoryContract(bundle, errors);
  validateCanonicalDisplayLanguage(bundle, errors);

  const duplicateWordIds = collectDuplicateValues(bundle.words.map((word) => word.id));
  for (const id of duplicateWordIds) {
    errors.push(scoped(gameId, `Duplicate word id: ${id}`));
  }

  const questions = bundle.questions ?? [];
  const duplicateQuestionIds = collectDuplicateValues(questions.map((question) => question.id));
  for (const id of duplicateQuestionIds) {
    errors.push(scoped(gameId, `Duplicate question id: ${id}`));
  }

  const categoryIds = new Set(bundle.categories.map((category) => category.id));

  for (const word of bundle.words) {
    if (!word.id.trim()) {
      errors.push(scoped(gameId, 'Word id must not be empty.'));
    }

    if (!word.text.trim()) {
      errors.push(scoped(gameId, `Word "${word.id}" must have text.`));
    } else if (!normalizeAcceptedAnswerKey(word.text)) {
      errors.push(scoped(gameId, `Word "${word.id}" text is empty after normalization.`));
    }

    if (word.text.length > CONTENT_MAX_WORD_TEXT_LENGTH) {
      errors.push(
        scoped(
          gameId,
          `Word "${word.id}" exceeds ${CONTENT_MAX_WORD_TEXT_LENGTH} characters.`,
        ),
      );
    }

    if (word.categoryId === VIRTUAL_RANDOM_CATEGORY_ID) {
      errors.push(
        scoped(gameId, `Word "${word.id}" must not use virtual category "${VIRTUAL_RANDOM_CATEGORY_ID}".`),
      );
    }

    if (!categoryIds.has(word.categoryId)) {
      errors.push(scoped(gameId, `Word "${word.id}" references unknown category "${word.categoryId}".`));
    }
  }

  for (const question of questions) {
    if (!question.id.trim()) {
      errors.push(scoped(gameId, 'Question id must not be empty.'));
    }

    if (!question.question.trim()) {
      errors.push(scoped(gameId, `Question "${question.id}" must have text.`));
    } else if (!normalizeAcceptedAnswerKey(question.question)) {
      errors.push(
        scoped(gameId, `Question "${question.id}" text is empty after normalization.`),
      );
    }

    if (question.question.length > CONTENT_MAX_QUESTION_TEXT_LENGTH) {
      errors.push(
        scoped(
          gameId,
          `Question "${question.id}" exceeds ${CONTENT_MAX_QUESTION_TEXT_LENGTH} characters.`,
        ),
      );
    }

    if (question.categoryId === VIRTUAL_RANDOM_CATEGORY_ID) {
      errors.push(
        scoped(
          gameId,
          `Question "${question.id}" must not use virtual category "${VIRTUAL_RANDOM_CATEGORY_ID}".`,
        ),
      );
    }

    if (!categoryIds.has(question.categoryId)) {
      errors.push(
        scoped(
          gameId,
          `Question "${question.id}" references unknown category "${question.categoryId}".`,
        ),
      );
    }

    validateAcceptedAnswers(bundle, question, errors);
  }

  validateCanonicalTextDuplicates(bundle, errors);
  validateGuessingChallengeAliasCollisions(bundle, errors);

  if (bundle.words.length === 0 && questions.length === 0) {
    errors.push(scoped(gameId, 'At least one word or question is required.'));
  }

  return errors.length > 0 ? failure(errors) : { valid: true };
}

export function validateGameStartContent(
  bundle: GameContentBundle,
  settings: GameContentSettings,
  connectedPlayers: number,
): ContentValidationResult {
  const errors: string[] = [];

  const checks = [
    validateContentBundle(bundle),
    validatePlayerCount(connectedPlayers, settings),
    validateEnabledCategories(bundle, settings),
  ];

  for (const result of checks) {
    if (!result.valid) {
      errors.push(...result.errors);
    }
  }

  return errors.length > 0 ? failure(errors) : { valid: true };
}

export function contentValidationToPluginError(result: ContentValidationResult): string | null {
  if (result.valid) {
    return null;
  }

  return result.errors[0] ?? 'Content validation failed.';
}
