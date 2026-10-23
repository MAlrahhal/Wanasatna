import { EMOJI_LANGUAGE_PICKER, normalizeTextAnswer } from '@wanasatna/shared';

export type EmojiLanguageAnswerPrompt = {
  id: string;
  answer: string;
  acceptedAnswers: readonly string[];
};

export type EmojiLanguageServerPuzzle = EmojiLanguageAnswerPrompt & {
  emojis: readonly string[];
};

/** Small provisional bank for closed playtesting; categories and final copy are not approved. */
export const EMOJI_LANGUAGE_PLAYER_PROMPTS: readonly EmojiLanguageAnswerPrompt[] = [
  {
    id: 'player-arabic-coffee',
    answer: 'القهوة العربية',
    acceptedAnswers: ['القهوة العربية', 'قهوة عربية'],
  },
  {
    id: 'player-football-match',
    answer: 'مباراة كرة القدم',
    acceptedAnswers: ['مباراة كرة القدم', 'مباراة كورة', 'كرة القدم'],
  },
  { id: 'player-wedding', answer: 'حفل زفاف', acceptedAnswers: ['حفل زفاف', 'زواج', 'عرس'] },
  {
    id: 'player-air-travel',
    answer: 'السفر بالطائرة',
    acceptedAnswers: ['السفر بالطائرة', 'سفر بالطائرة', 'رحلة جوية'],
  },
  { id: 'player-school', answer: 'المدرسة', acceptedAnswers: ['المدرسة', 'مدرسة'] },
  { id: 'player-hospital', answer: 'المستشفى', acceptedAnswers: ['المستشفى', 'مستشفى'] },
  { id: 'player-rain', answer: 'يوم ممطر', acceptedAnswers: ['يوم ممطر', 'المطر', 'جو ممطر'] },
  {
    id: 'player-desert',
    answer: 'رحلة في الصحراء',
    acceptedAnswers: ['رحلة في الصحراء', 'الصحراء', 'رحلة صحراوية'],
  },
  { id: 'player-shopping', answer: 'التسوق', acceptedAnswers: ['التسوق', 'تسوق'] },
  {
    id: 'player-bedtime',
    answer: 'وقت النوم',
    acceptedAnswers: ['وقت النوم', 'النوم', 'موعد النوم'],
  },
  { id: 'player-birthday', answer: 'عيد ميلاد', acceptedAnswers: ['عيد ميلاد', 'حفلة عيد ميلاد'] },
  {
    id: 'player-cinema',
    answer: 'مشاهدة فيلم',
    acceptedAnswers: ['مشاهدة فيلم', 'فيلم', 'السينما'],
  },
  {
    id: 'player-exam',
    answer: 'اختبار مدرسي',
    acceptedAnswers: ['اختبار مدرسي', 'اختبار', 'امتحان'],
  },
  {
    id: 'player-traffic',
    answer: 'زحمة المرور',
    acceptedAnswers: ['زحمة المرور', 'زحمة', 'ازدحام مروري'],
  },
  {
    id: 'player-beach',
    answer: 'يوم على الشاطئ',
    acceptedAnswers: ['يوم على الشاطئ', 'الشاطئ', 'البحر'],
  },
] as const;

/** Hand-authored clue-to-answer pairs for the server-puzzle mode. */
export const EMOJI_LANGUAGE_SERVER_PUZZLES: readonly EmojiLanguageServerPuzzle[] = [
  {
    id: 'server-lion-king',
    emojis: ['🦁', '👑'],
    answer: 'الأسد الملك',
    acceptedAnswers: ['الأسد الملك', 'اسد الملك', 'The Lion King', 'Lion King'],
  },
  {
    id: 'server-finding-nemo',
    emojis: ['🔎', '🐠'],
    answer: 'البحث عن نيمو',
    acceptedAnswers: ['البحث عن نيمو', 'نيمو', 'Finding Nemo'],
  },
  {
    id: 'server-home-alone',
    emojis: ['👦', '🏠'],
    answer: 'وحدي في المنزل',
    acceptedAnswers: ['وحدي في المنزل', 'وحده في المنزل', 'Home Alone'],
  },
  {
    id: 'server-moon-trip',
    emojis: ['🚀', '🌕'],
    answer: 'رحلة إلى القمر',
    acceptedAnswers: ['رحلة إلى القمر', 'رحلة للقمر', 'السفر إلى القمر'],
  },
  {
    id: 'server-bedtime',
    emojis: ['🌙', '🛏️', '😴'],
    answer: 'وقت النوم',
    acceptedAnswers: ['وقت النوم', 'النوم', 'موعد النوم'],
  },
  {
    id: 'server-breakfast',
    emojis: ['☀️', '🍳', '☕'],
    answer: 'فطور الصباح',
    acceptedAnswers: ['فطور الصباح', 'الفطور', 'وجبة الفطور'],
  },
  {
    id: 'server-traffic',
    emojis: ['🚗', '🚕', '🚙', '🚦'],
    answer: 'زحمة المرور',
    acceptedAnswers: ['زحمة المرور', 'زحمة', 'ازدحام مروري'],
  },
  {
    id: 'server-birthday',
    emojis: ['🎂', '🎈', '🎉'],
    answer: 'حفلة عيد ميلاد',
    acceptedAnswers: ['حفلة عيد ميلاد', 'عيد ميلاد'],
  },
  {
    id: 'server-rainy-day',
    emojis: ['🌧️', '☔'],
    answer: 'يوم ممطر',
    acceptedAnswers: ['يوم ممطر', 'المطر', 'جو ممطر'],
  },
  {
    id: 'server-exam-study',
    emojis: ['📚', '✏️', '📝'],
    answer: 'الدراسة للاختبار',
    acceptedAnswers: ['الدراسة للاختبار', 'المذاكرة للاختبار', 'الاستعداد للاختبار'],
  },
  {
    id: 'server-air-travel',
    emojis: ['🧳', '✈️'],
    answer: 'السفر بالطائرة',
    acceptedAnswers: ['السفر بالطائرة', 'سفر بالطائرة', 'رحلة جوية'],
  },
  {
    id: 'server-football',
    emojis: ['⚽', '🏟️', '🏆'],
    answer: 'مباراة كرة القدم',
    acceptedAnswers: ['مباراة كرة القدم', 'مباراة كورة', 'كرة القدم'],
  },
  {
    id: 'server-movie-night',
    emojis: ['🌙', '🎬', '🍿'],
    answer: 'ليلة فيلم',
    acceptedAnswers: ['ليلة فيلم', 'مشاهدة فيلم', 'سهرة سينما'],
  },
  {
    id: 'server-family-home',
    emojis: ['👨‍👩‍👧‍👦', '🏠', '❤️'],
    answer: 'العائلة في المنزل',
    acceptedAnswers: ['العائلة في المنزل', 'البيت العائلي', 'العائلة'],
  },
  {
    id: 'server-bright-idea',
    emojis: ['🤔', '💡'],
    answer: 'فكرة ذكية',
    acceptedAnswers: ['فكرة ذكية', 'فكرة', 'خطرت له فكرة'],
  },
] as const;

export function validateEmojiLanguageProvisionalContent():
  { success: true } | { success: false; error: string } {
  const approved = new Set<string>(EMOJI_LANGUAGE_PICKER);
  const ids = new Set<string>();
  for (const entry of [...EMOJI_LANGUAGE_PLAYER_PROMPTS, ...EMOJI_LANGUAGE_SERVER_PUZZLES]) {
    if (ids.has(entry.id)) return { success: false, error: `Duplicate content ID: ${entry.id}` };
    ids.add(entry.id);
    if (!entry.answer.trim() || entry.acceptedAnswers.length === 0) {
      return { success: false, error: `Empty answer content: ${entry.id}` };
    }
    if (
      !entry.acceptedAnswers.some(
        (value) => normalizeTextAnswer(value) === normalizeTextAnswer(entry.answer),
      )
    ) {
      return { success: false, error: `Canonical answer is not accepted: ${entry.id}` };
    }
  }

  for (const bank of [EMOJI_LANGUAGE_PLAYER_PROMPTS, EMOJI_LANGUAGE_SERVER_PUZZLES]) {
    const canonicalAnswers = new Set<string>();
    for (const entry of bank) {
      const canonical = normalizeTextAnswer(entry.answer);
      if (canonicalAnswers.has(canonical)) {
        return { success: false, error: `Duplicate canonical answer: ${entry.answer}` };
      }
      canonicalAnswers.add(canonical);
    }
  }

  for (const puzzle of EMOJI_LANGUAGE_SERVER_PUZZLES) {
    if (puzzle.emojis.length < 1 || puzzle.emojis.length > 10) {
      return { success: false, error: `Invalid emoji count: ${puzzle.id}` };
    }
    if (puzzle.emojis.some((emoji) => !approved.has(emoji))) {
      return { success: false, error: `Unapproved emoji token: ${puzzle.id}` };
    }
  }

  return { success: true };
}
