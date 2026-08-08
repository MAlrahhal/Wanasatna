export type GameContentCategory = {
  id: string;
  name: string;
  enabled: boolean;
};

export type GameContentWord = {
  id: string;
  text: string;
  categoryId: string;
};

export type GameContentBundle = {
  gameId: string;
  categories: GameContentCategory[];
  words: GameContentWord[];
};

export type ContentValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };
