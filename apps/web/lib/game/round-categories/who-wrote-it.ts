import type { GameRoundCategoriesConfig } from './types';

export const whoWroteItRoundCategories: GameRoundCategoriesConfig = {
  defaultCategoryId: 'random',
  categories: [
    { id: 'funny-situations', label: 'مواقف مضحكة', emoji: '😂' },
    { id: 'confessions', label: 'اعترافات', emoji: '🤫' },
    { id: 'light-personal', label: 'أسئلة شخصية خفيفة', emoji: '🤔' },
    { id: 'what-would-you-do', label: 'ماذا ستفعل؟', emoji: '💭' },
    { id: 'random', label: 'عشوائي', emoji: '🎲' },
  ],
};
