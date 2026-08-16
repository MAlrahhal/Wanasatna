/**
 * Prefill Home Create/Join name from the account preferred display name.
 * Never overwrite a field the user has already typed into.
 */
export function nextPrefillDisplayName(input: {
  currentName: string;
  hasUserEditedName: boolean;
  preferredDisplayName: string | null | undefined;
}): string | null {
  if (input.hasUserEditedName) {
    return null;
  }

  const preferred = input.preferredDisplayName?.trim() ?? '';
  if (!preferred) {
    return null;
  }

  if (input.currentName.trim() !== '') {
    return null;
  }

  return preferred;
}
