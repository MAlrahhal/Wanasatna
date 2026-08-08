import type { GameContentBundle, GameContentCategory } from './types.js';
import type { GameContentSettings } from './settings.js';
import type { ContentValidationResult } from './types.js';
import { resolveEnabledCategoryIds } from './word-picker.js';

function failure(errors: string[]): ContentValidationResult {
  return { valid: false, errors };
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

  if (wordsInEnabledCategories.length === 0) {
    return failure(['At least one word is required in the enabled categories.']);
  }

  return { valid: true };
}

export function validateCategoryDefinitions(categories: GameContentCategory[]): ContentValidationResult {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const category of categories) {
    if (seenIds.has(category.id)) {
      errors.push(`Duplicate category id: ${category.id}`);
    }

    seenIds.add(category.id);

    if (!category.name.trim()) {
      errors.push(`Category "${category.id}" must have a name.`);
    }
  }

  return errors.length > 0 ? failure(errors) : { valid: true };
}

export function validateContentBundle(bundle: GameContentBundle): ContentValidationResult {
  const errors: string[] = [];

  const categoryValidation = validateCategoryDefinitions(bundle.categories);
  if (!categoryValidation.valid) {
    errors.push(...categoryValidation.errors);
  }

  const categoryIds = new Set(bundle.categories.map((category) => category.id));

  for (const word of bundle.words) {
    if (!word.text.trim()) {
      errors.push(`Word "${word.id}" must have text.`);
    }

    if (!categoryIds.has(word.categoryId)) {
      errors.push(`Word "${word.id}" references unknown category "${word.categoryId}".`);
    }
  }

  if (bundle.words.length === 0) {
    errors.push('At least one word is required.');
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
