const ROUND_SUFFIX = /\s*[—–-]\s*الجولة\s*\d+\s*\/\s*\d+\s*$/u;
const SPECTATOR_PHASE_LABELS = new Set(['مشاهدة', 'الجولة جارية', 'الجولة جارية 👀']);

/** Strip duplicated round metadata from experience-header phase labels. */
export function stripRoundSuffixFromPhaseLabel(label: string): string {
  return label.replace(ROUND_SUFFIX, '').trim();
}

/** Shared shell spectator wording. Does not change game body copy. */
export function normalizeExperiencePhaseLabel(label: string | undefined | null): string | undefined {
  if (!label) {
    return undefined;
  }

  const stripped = stripRoundSuffixFromPhaseLabel(label);
  if (!stripped) {
    return undefined;
  }

  if (SPECTATOR_PHASE_LABELS.has(stripped)) {
    return 'مشاهدة';
  }

  return stripped;
}
