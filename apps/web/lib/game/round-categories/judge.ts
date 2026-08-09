import type { GameRoundCategoriesConfig } from './types';

export const judgeRoundCategories: GameRoundCategoriesConfig = {
  defaultCategoryId: 'random',
  categories: [
    { id: 'funny', label: 'مواقف مضحكة', emoji: '😂' },
    { id: 'hypothetical', label: 'مواقف افتراضية', emoji: '🤔' },
    { id: 'daily', label: 'الحياة اليومية', emoji: '💼' },
    { id: 'weird', label: 'مواقف غريبة', emoji: '🎭' },
    { id: 'random', label: 'عشوائي', emoji: '🎲' },
  ],
};
