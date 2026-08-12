import type { LobbyGame, LobbyGameSettingsPlaceholder } from './types';

export const mockLobbyGames: LobbyGame[] = [
  {
    id: 'bara-al-salafa',
    title: 'برا السالفة',
    description: 'اكتشف من برا السالفة قبل ما ينكشف!',
    iconLabel: 'ب',
    emoji: '🕵️',
  },
  {
    id: 'draw-guess',
    title: 'ارسم وخمن',
    description: 'ارسم الكلمة وخمّن رسم باقي اللاعبين.',
    iconLabel: 'ر',
    emoji: '🎨',
  },
  {
    id: 'imposter-draw',
    title: 'الإمبوستر بالرسم',
    description: 'امبوستر يحاول يتموّه… والباقي يحاولون يكشفونه.',
    iconLabel: 'إ',
    emoji: '🎭',
  },
  {
    id: 'timing-challenge',
    title: 'تحدي التوقيت',
    description: 'اضغط في اللحظة المناسبة واختبر سرعة ردود فعلك.',
    iconLabel: 'ت',
    emoji: '⏱️',
  },
  {
    id: 'who-wrote-it',
    title: 'من كتبها؟',
    description: 'خمّن مين كتب الجملة بين إجابات اللاعبين.',
    iconLabel: 'م',
    emoji: '✍️',
  },
  {
    id: 'judge',
    title: 'القاضي',
    description: 'القاضي يحكم… والباقي يحاولون يقنعونه.',
    iconLabel: 'ق',
    emoji: '⚖️',
  },
  {
    id: 'guessing-challenge',
    title: 'تحدي التخمين',
    description: 'اعرف هويتك قبل خصمك',
    iconLabel: 'ت',
    emoji: '🎯',
  },
  {
    id: 'fast-answer',
    title: 'أسرع إجابة',
    description: 'أسئلة سريعة… أول واحد يجيب صح يكسب النقاط.',
    iconLabel: 'س',
    emoji: '⚡',
  },
  {
    id: 'marathon',
    title: 'Marathon',
    description: 'سلسلة ألعاب متتابعة في جلسة واحدة.',
    iconLabel: 'M',
    emoji: '🎲',
  },
];

export const mockGameSettingsByGameId: Record<string, LobbyGameSettingsPlaceholder[]> = {
  'bara-al-salafa': [],
  'draw-guess': [
    { id: 'rounds', label: 'عدد الجولات', value: '٣ جولات' },
    { id: 'drawer', label: 'اختيار الرسام', value: 'عشوائي / لاعب محدد' },
    { id: 'draw-time', label: 'وقت الرسم', value: '٦٠ ثانية' },
  ],
  'imposter-draw': [
    { id: 'rounds', label: 'عدد الجولات', value: '٤ جولات' },
    { id: 'imposters', label: 'عدد الإمبوستر', value: '١' },
  ],
  'timing-challenge': [
    { id: 'rounds', label: 'عدد الجولات', value: '٣ جولات' },
    { id: 'mode', label: 'وضع اللعب', value: 'تخمين / أوقف' },
    { id: 'range', label: 'نطاق الوقت', value: '٣–١٥ ثانية' },
  ],
  'who-wrote-it': [
    { id: 'info-rounds', label: 'عدد الجولات', value: '٣ جولات ثابتة' },
    { id: 'info-time', label: 'وقت الكتابة', value: '٦٠ ثانية' },
  ],
  judge: [
    { id: 'rounds', label: 'عدد الجولات', value: '٣ جولات' },
    { id: 'cases', label: 'نوع القضايا', value: 'مختلط' },
  ],
  'guessing-challenge': [
    { id: 'rounds', label: 'عدد الجولات', value: '٤ جولات' },
    { id: 'mode', label: 'وضع اللعب', value: '1 ضد 1 / 2 ضد 2' },
    { id: 'players', label: 'عدد اللاعبين', value: '٢ أو ٤' },
  ],
  'fast-answer': [
    { id: 'info-rounds', label: 'عدد الجولات', value: '٥ جولات ثابتة' },
    { id: 'info-time', label: 'وقت السؤال', value: '١٥ ثانية' },
  ],
  marathon: [
    { id: 'games', label: 'عدد الألعاب', value: '٣ ألعاب' },
    { id: 'order', label: 'ترتيب الألعاب', value: 'عشوائي' },
  ],
};
