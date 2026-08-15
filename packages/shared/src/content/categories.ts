export const VIRTUAL_RANDOM_CATEGORY_ID = 'random' as const;
export const VIRTUAL_RANDOM_CATEGORY_LABEL = 'عشوائي';

export type GameContentCategoryContract = {
  ids: readonly string[];
  labels: Readonly<Record<string, string>>;
};

/** Trivia / conversation pack used by Bara and Fast Answer. */
export const TRIVIA_CONTENT_CATEGORY_IDS = [
  'animals',
  'food',
  'countries',
  'cars',
  'football',
  'movies',
  'series',
  'games',
  'tech',
] as const;

export const TRIVIA_CONTENT_CATEGORY_LABELS: Record<
  (typeof TRIVIA_CONTENT_CATEGORY_IDS)[number],
  string
> = {
  animals: 'حيوانات',
  food: 'أكلات',
  countries: 'بلدان',
  cars: 'سيارات',
  football: 'كرة قدم',
  movies: 'أفلام',
  series: 'مسلسلات',
  games: 'ألعاب',
  tech: 'تقنيات',
};

/** Drawable pack used by Draw & Guess and Imposter Draw. */
export const DRAWABLE_CONTENT_CATEGORY_IDS = [
  'animals',
  'food',
  'household',
  'tools',
  'transport',
  'professions',
  'nature',
  'sports',
  'clothing',
  'places',
] as const;

export const DRAWABLE_CONTENT_CATEGORY_LABELS: Record<
  (typeof DRAWABLE_CONTENT_CATEGORY_IDS)[number],
  string
> = {
  animals: 'حيوانات',
  food: 'أكلات',
  household: 'أغراض منزلية',
  tools: 'أدوات',
  transport: 'مواصلات',
  professions: 'مهن',
  nature: 'طبيعة',
  sports: 'رياضة',
  clothing: 'ملابس وإكسسوارات',
  places: 'أماكن',
};

export const GUESSING_CHALLENGE_CONTENT_CATEGORY_IDS = [
  'animals',
  'food',
  'countries',
  'cars',
  'football',
  'movies',
  'series',
  'games',
  'tech',
  'household',
  'tools',
] as const;

export const GUESSING_CHALLENGE_CONTENT_CATEGORY_LABELS: Record<
  (typeof GUESSING_CHALLENGE_CONTENT_CATEGORY_IDS)[number],
  string
> = {
  animals: 'حيوانات',
  food: 'أكلات',
  countries: 'بلدان',
  cars: 'سيارات',
  football: 'كرة قدم',
  movies: 'أفلام',
  series: 'مسلسلات',
  games: 'ألعاب',
  tech: 'تقنيات',
  household: 'أغراض منزلية',
  tools: 'أدوات',
};

export const WHO_WROTE_IT_CONTENT_CATEGORY_IDS = [
  'funny',
  'personal',
  'situations',
  'preferences',
] as const;

export const WHO_WROTE_IT_CONTENT_CATEGORY_LABELS: Record<
  (typeof WHO_WROTE_IT_CONTENT_CATEGORY_IDS)[number],
  string
> = {
  funny: 'أسئلة مضحكة',
  personal: 'أسئلة شخصية',
  situations: 'مواقف',
  preferences: 'تفضيلات',
};

export const JUDGE_CONTENT_CATEGORY_IDS = [
  'funny',
  'hypothetical',
  'daily',
  'weird',
] as const;

export const JUDGE_CONTENT_CATEGORY_LABELS: Record<
  (typeof JUDGE_CONTENT_CATEGORY_IDS)[number],
  string
> = {
  funny: 'مواقف مضحكة',
  hypothetical: 'مواقف افتراضية',
  daily: 'الحياة اليومية',
  weird: 'مواقف غريبة',
};

const triviaContract: GameContentCategoryContract = {
  ids: TRIVIA_CONTENT_CATEGORY_IDS,
  labels: TRIVIA_CONTENT_CATEGORY_LABELS,
};

const drawableContract: GameContentCategoryContract = {
  ids: DRAWABLE_CONTENT_CATEGORY_IDS,
  labels: DRAWABLE_CONTENT_CATEGORY_LABELS,
};

export const GAME_CONTENT_CATEGORY_CONTRACTS: Record<string, GameContentCategoryContract> = {
  'bara-al-salafa': triviaContract,
  'fast-answer': triviaContract,
  'draw-guess': drawableContract,
  'imposter-draw': drawableContract,
  'guessing-challenge': {
    ids: GUESSING_CHALLENGE_CONTENT_CATEGORY_IDS,
    labels: GUESSING_CHALLENGE_CONTENT_CATEGORY_LABELS,
  },
  'who-wrote-it': {
    ids: WHO_WROTE_IT_CONTENT_CATEGORY_IDS,
    labels: WHO_WROTE_IT_CONTENT_CATEGORY_LABELS,
  },
  judge: {
    ids: JUDGE_CONTENT_CATEGORY_IDS,
    labels: JUDGE_CONTENT_CATEGORY_LABELS,
  },
};

/** Categories whose canonical display should be Arabic. */
export const ARABIC_CANONICAL_CATEGORY_IDS = [
  'animals',
  'food',
  'countries',
  'football',
  'household',
  'tools',
  'transport',
  'professions',
  'nature',
  'sports',
  'clothing',
  'places',
] as const;

/** Title-style categories whose canonical display should be Latin-script. */
export const LATIN_CANONICAL_CATEGORY_IDS = ['movies', 'series', 'games'] as const;

export function getGameContentCategoryContract(
  gameId: string,
): GameContentCategoryContract | null {
  return GAME_CONTENT_CATEGORY_CONTRACTS[gameId] ?? null;
}

export function isVirtualRandomCategoryId(categoryId: string): boolean {
  return categoryId === VIRTUAL_RANDOM_CATEGORY_ID;
}

export function canonicalHasArabicScript(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

export function canonicalHasLatinScript(value: string): boolean {
  return /[A-Za-z]/.test(value);
}
