import type { GameRoundCategoriesConfig } from './types';

export const guessingChallengeRoundCategories: GameRoundCategoriesConfig = {
  defaultCategoryId: 'random',
  categories: [
    { id: 'animals', label: 'حيوانات', emoji: '🐶' },
    { id: 'food', label: 'أكلات', emoji: '🍔' },
    { id: 'countries', label: 'بلدان', emoji: '🌍' },
    { id: 'football', label: 'كرة قدم', emoji: '⚽' },
    { id: 'series', label: 'مسلسلات', emoji: '📺' },
    { id: 'games', label: 'ألعاب', emoji: '🎮' },
    { id: 'tech', label: 'تقنيات', emoji: '📱' },
    { id: 'random', label: 'عشوائي', emoji: '🎲' },
  ],
};
