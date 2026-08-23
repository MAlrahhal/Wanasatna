import type { GameRoundCategoriesConfig } from './types';

/** Drawable categories for Draw & Guess and Imposter Draw. */
export const drawableRoundCategories: GameRoundCategoriesConfig = {
  defaultCategoryId: 'random',
  categories: [
    { id: 'animals', label: 'حيوانات', emoji: '🐶' },
    { id: 'food', label: 'أكلات', emoji: '🍔' },
    { id: 'nature', label: 'طبيعة وفضاء وطقس', emoji: '🌋' },
    { id: 'places', label: 'أماكن ومعالم واضحة', emoji: '🏫' },
    { id: 'tech', label: 'تقنيات', emoji: '📱' },
    { id: 'random', label: 'عشوائي', emoji: '🎲' },
  ],
};
