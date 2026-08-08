const ARABIC_SCRIPT_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

export function isArabicScriptName(name: string): boolean {
  return ARABIC_SCRIPT_PATTERN.test(name);
}

function compareNamesForTieBreak(nameA: string, nameB: string): number {
  const aArabic = isArabicScriptName(nameA);
  const bArabic = isArabicScriptName(nameB);

  if (aArabic !== bArabic) {
    return aArabic ? -1 : 1;
  }

  const locale = aArabic ? 'ar' : 'en';
  return nameA.localeCompare(nameB, locale, { sensitivity: 'base' });
}

type ScoreSortable = {
  score: number;
  name: string;
  playerId?: string;
};

type RoundPointsSortable = {
  roundPoints: number;
  name: string;
  playerId?: string;
};

export function compareByScoreThenName(left: ScoreSortable, right: ScoreSortable): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  const nameComparison = compareNamesForTieBreak(left.name, right.name);

  if (nameComparison !== 0) {
    return nameComparison;
  }

  if (left.playerId && right.playerId) {
    return left.playerId.localeCompare(right.playerId);
  }

  return 0;
}

export function compareByRoundPointsThenName(
  left: RoundPointsSortable,
  right: RoundPointsSortable,
): number {
  if (right.roundPoints !== left.roundPoints) {
    return right.roundPoints - left.roundPoints;
  }

  const nameComparison = compareNamesForTieBreak(left.name, right.name);

  if (nameComparison !== 0) {
    return nameComparison;
  }

  if (left.playerId && right.playerId) {
    return left.playerId.localeCompare(right.playerId);
  }

  return 0;
}
