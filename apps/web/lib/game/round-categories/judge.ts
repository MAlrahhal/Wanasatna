import type { GameRoundCategoriesConfig } from './types';

export const judgeRoundCategories: GameRoundCategoriesConfig = {
  defaultCategoryId: 'random',
  categories: [
    { id: 'worst-answer', label: 'أسوأ إجابة ممكنة', emoji: '🙃' },
    { id: 'invent-something-silly', label: 'اخترع شيء غبي', emoji: '💡' },
    { id: 'weird-scenarios', label: 'سيناريوهات غريبة', emoji: '🎭' },
    { id: 'complete-the-sentence', label: 'كمل الجملة', emoji: '✍️' },
    { id: 'rapid-response', label: 'تحديات الرد السريع', emoji: '⚡' },
    { id: 'random', label: 'عشوائي', emoji: '🎲' },
  ],
};
