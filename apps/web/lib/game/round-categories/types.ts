export type RoundCategory = {
  id: string;
  label: string;
  emoji: string;
};

export type GameRoundCategoriesConfig = {
  categories: readonly RoundCategory[];
  defaultCategoryId: string;
};
