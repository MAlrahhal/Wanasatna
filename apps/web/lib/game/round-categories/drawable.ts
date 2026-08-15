import type { GameRoundCategoriesConfig } from './types';

/** Drawable categories for Draw & Guess and Imposter Draw. */
export const drawableRoundCategories: GameRoundCategoriesConfig = {
  defaultCategoryId: 'random',
  categories: [
    { id: 'animals', label: 'حيوانات', emoji: '🐶' },
    { id: 'food', label: 'أكلات', emoji: '🍔' },
    { id: 'household', label: 'أغراض منزلية', emoji: '🏠' },
    { id: 'tools', label: 'أدوات', emoji: '🔧' },
    { id: 'transport', label: 'مواصلات', emoji: '🚌' },
    { id: 'random', label: 'عشوائي', emoji: '🎲' },
    { id: 'professions', label: 'مهن', emoji: '👨‍⚕️' },
    { id: 'nature', label: 'طبيعة', emoji: '🌋' },
    { id: 'sports', label: 'رياضة', emoji: '🏀' },
    { id: 'clothing', label: 'ملابس وإكسسوارات', emoji: '👕' },
    { id: 'places', label: 'أماكن', emoji: '🏫' },
  ],
};
