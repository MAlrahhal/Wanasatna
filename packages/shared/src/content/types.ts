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

export type GameContentQuestion = {
  id: string;
  categoryId: string;
  question: string;
  acceptedAnswers: string[];
};

export type GameContentBundle = {
  gameId: string;
  categories: GameContentCategory[];
  words: GameContentWord[];
  questions?: GameContentQuestion[];
};

export type ContentValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };
