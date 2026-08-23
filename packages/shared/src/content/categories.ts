export const VIRTUAL_RANDOM_CATEGORY_ID = 'random' as const;
export const VIRTUAL_RANDOM_CATEGORY_LABEL = 'عشوائي';

export type GameContentCategoryContract = {
  ids: readonly string[];
  labels: Readonly<Record<string, string>>;
};

export const BARA_AL_SALAFA_CONTENT_CATEGORY_IDS = [
  'animals',
  'food',
  'countries',
  'football',
  'series',
  'games',
] as const;

export const BARA_AL_SALAFA_CONTENT_CATEGORY_LABELS: Record<
  (typeof BARA_AL_SALAFA_CONTENT_CATEGORY_IDS)[number],
  string
> = {
  animals: 'حيوانات',
  food: 'أكلات',
  countries: 'بلدان',
  football: 'كرة قدم',
  series: 'مسلسلات',
  games: 'ألعاب',
};

export const FAST_ANSWER_CONTENT_CATEGORY_IDS = [
  'animals',
  'food',
  'countries',
  'series',
  'games',
] as const;

export const FAST_ANSWER_CONTENT_CATEGORY_LABELS: Record<
  (typeof FAST_ANSWER_CONTENT_CATEGORY_IDS)[number],
  string
> = {
  animals: 'حيوانات',
  food: 'أكلات',
  countries: 'بلدان',
  series: 'مسلسلات',
  games: 'ألعاب',
};

export const DRAWABLE_CONTENT_CATEGORY_IDS = [
  'animals',
  'food',
  'nature',
  'places',
  'tech',
] as const;

export const DRAWABLE_CONTENT_CATEGORY_LABELS: Record<
  (typeof DRAWABLE_CONTENT_CATEGORY_IDS)[number],
  string
> = {
  animals: 'حيوانات',
  food: 'أكلات',
  nature: 'طبيعة وفضاء وطقس',
  places: 'أماكن ومعالم واضحة',
  tech: 'تقنيات',
};

export const GUESSING_CHALLENGE_CONTENT_CATEGORY_IDS = [
  'animals',
  'food',
  'countries',
  'football',
  'series',
  'games',
  'tech',
] as const;

export const GUESSING_CHALLENGE_CONTENT_CATEGORY_LABELS: Record<
  (typeof GUESSING_CHALLENGE_CONTENT_CATEGORY_IDS)[number],
  string
> = {
  animals: 'حيوانات',
  food: 'أكلات',
  countries: 'بلدان',
  football: 'كرة قدم',
  series: 'مسلسلات',
  games: 'ألعاب',
  tech: 'تقنيات',
};

export const WHO_WROTE_IT_CONTENT_CATEGORY_IDS = [
  'funny-situations',
  'confessions',
  'light-personal',
  'what-would-you-do',
] as const;

export const WHO_WROTE_IT_CONTENT_CATEGORY_LABELS: Record<
  (typeof WHO_WROTE_IT_CONTENT_CATEGORY_IDS)[number],
  string
> = {
  'funny-situations': 'مواقف مضحكة',
  confessions: 'اعترافات',
  'light-personal': 'أسئلة شخصية خفيفة',
  'what-would-you-do': 'ماذا ستفعل؟',
};

export const JUDGE_CONTENT_CATEGORY_IDS = [
  'worst-answer',
  'invent-something-silly',
  'weird-scenarios',
  'complete-the-sentence',
  'rapid-response',
] as const;

export const JUDGE_CONTENT_CATEGORY_LABELS: Record<
  (typeof JUDGE_CONTENT_CATEGORY_IDS)[number],
  string
> = {
  'worst-answer': 'أسوأ إجابة ممكنة',
  'invent-something-silly': 'اخترع شيء غبي',
  'weird-scenarios': 'سيناريوهات غريبة',
  'complete-the-sentence': 'كمل الجملة',
  'rapid-response': 'تحديات الرد السريع',
};

const drawableContract: GameContentCategoryContract = {
  ids: DRAWABLE_CONTENT_CATEGORY_IDS,
  labels: DRAWABLE_CONTENT_CATEGORY_LABELS,
};

export const GAME_CONTENT_CATEGORY_CONTRACTS: Record<string, GameContentCategoryContract> = {
  'bara-al-salafa': {
    ids: BARA_AL_SALAFA_CONTENT_CATEGORY_IDS,
    labels: BARA_AL_SALAFA_CONTENT_CATEGORY_LABELS,
  },
  'fast-answer': {
    ids: FAST_ANSWER_CONTENT_CATEGORY_IDS,
    labels: FAST_ANSWER_CONTENT_CATEGORY_LABELS,
  },
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
  'tech',
] as const;

/** Title-style categories whose canonical display should be Latin-script. */
export const LATIN_CANONICAL_CATEGORY_IDS = ['movies', 'series', 'games'] as const;

export function getGameContentCategoryContract(gameId: string): GameContentCategoryContract | null {
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
