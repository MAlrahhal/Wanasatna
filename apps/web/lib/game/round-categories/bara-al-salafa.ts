import type { GameRoundCategoriesConfig } from './types';

/** Presentation order matches the lobby reference (RTL: first item on the right). */
export const baraAlSalafaRoundCategories: GameRoundCategoriesConfig = {
  defaultCategoryId: 'random',
  categories: [
    { id: 'football', label: 'كرة قدم', emoji: '⚽' },
    { id: 'cars', label: 'سيارات', emoji: '🚗' },
    { id: 'countries', label: 'بلدان', emoji: '🌍' },
    { id: 'food', label: 'أكلات', emoji: '🍔' },
    { id: 'animals', label: 'حيوانات', emoji: '🐶' },
    { id: 'random', label: 'عشوائي', emoji: '🎲' },
    { id: 'tech', label: 'تقنيات', emoji: '📱' },
    { id: 'games', label: 'ألعاب', emoji: '🎮' },
    { id: 'series', label: 'مسلسلات', emoji: '📺' },
    { id: 'movies', label: 'أفلام', emoji: '🎬' },
  ],
};
