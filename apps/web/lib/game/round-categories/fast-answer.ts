import type { GameRoundCategoriesConfig } from './types';

export const fastAnswerRoundCategories: GameRoundCategoriesConfig = {
  defaultCategoryId: 'random',
  categories: [
    { id: 'animals', label: 'حيوانات', emoji: '🐶' },
    { id: 'food', label: 'أكلات', emoji: '🍔' },
    { id: 'countries', label: 'بلدان', emoji: '🌍' },
    { id: 'series', label: 'مسلسلات', emoji: '📺' },
    { id: 'games', label: 'ألعاب', emoji: '🎮' },
    { id: 'random', label: 'عشوائي', emoji: '🎲' },
  ],
};
