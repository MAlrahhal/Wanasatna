import type { GameRoundCategoriesConfig } from './types';

export const whoWroteItRoundCategories: GameRoundCategoriesConfig = {
  defaultCategoryId: 'random',
  categories: [
    { id: 'funny', label: 'أسئلة مضحكة', emoji: '😂' },
    { id: 'personal', label: 'أسئلة شخصية', emoji: '🤔' },
    { id: 'situations', label: 'مواقف', emoji: '💭' },
    { id: 'preferences', label: 'تفضيلات', emoji: '❤️' },
    { id: 'random', label: 'عشوائي', emoji: '🎲' },
  ],
};
