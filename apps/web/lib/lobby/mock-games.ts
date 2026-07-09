import type { LobbyGame, LobbyGameSettingsPlaceholder } from './types';

export const mockLobbyGames: LobbyGame[] = [
  {
    id: 'bara-al-salafa',
    title: 'برا السالفة',
    description: 'اكتشف من برا السالفة قبل ما ينكشف!',
    iconLabel: 'ب',
  },
  {
    id: 'draw-guess',
    title: 'ارسم وخمن',
    description: 'ارسم الكلمة وخمّن رسم باقي اللاعبين.',
    iconLabel: 'ر',
  },
  {
    id: 'imposter-draw',
    title: 'الإمبوستر بالرسم',
    description: 'امبوستر يحاول يتموّه… والباقي يحاولون يكشفونه.',
    iconLabel: 'إ',
  },
  {
    id: 'timing-challenge',
    title: 'تحدي التوقيت',
    description: 'اضغط في اللحظة المناسبة واختبر سرعة ردود فعلك.',
    iconLabel: 'ت',
  },
  {
    id: 'who-wrote-it',
    title: 'من كتبها؟',
    description: 'خمّن مين كتب الجملة بين إجابات اللاعبين.',
    iconLabel: 'م',
  },
  {
    id: 'judge',
    title: 'القاضي',
    description: 'القاضي يحكم… والباقي يحاولون يقنعونه.',
    iconLabel: 'ق',
  },
  {
    id: 'guess-challenge',
    title: 'تحدي التخمين',
    description: 'أسئلة سريعة… أول واحد يخمّن صح يكسب.',
    iconLabel: 'خ',
  },
  {
    id: 'marathon',
    title: 'Marathon',
    description: 'سلسلة ألعاب متتابعة في جلسة واحدة.',
    iconLabel: 'M',
  },
];

export const mockGameSettingsByGameId: Record<string, LobbyGameSettingsPlaceholder[]> = {
  'bara-al-salafa': [
    { id: 'rounds', label: 'عدد الجولات', value: '٣ جولات' },
    { id: 'timer', label: 'مدة النقاش', value: '٣ دقائق' },
  ],
  'draw-guess': [
    { id: 'rounds', label: 'عدد الجولات', value: '٥ جولات' },
    { id: 'draw-time', label: 'وقت الرسم', value: '٦٠ ثانية' },
  ],
  'imposter-draw': [
    { id: 'rounds', label: 'عدد الجولات', value: '٤ جولات' },
    { id: 'imposters', label: 'عدد الإمبوستر', value: '١' },
  ],
  'timing-challenge': [
    { id: 'rounds', label: 'عدد الجولات', value: '٦ جولات' },
    { id: 'difficulty', label: 'الصعوبة', value: 'متوسط' },
  ],
  'who-wrote-it': [
    { id: 'rounds', label: 'عدد الجولات', value: '٤ جولات' },
    { id: 'prompts', label: 'نوع الأسئلة', value: 'عشوائي' },
  ],
  judge: [
    { id: 'rounds', label: 'عدد الجولات', value: '٣ جولات' },
    { id: 'cases', label: 'نوع القضايا', value: 'مختلط' },
  ],
  'guess-challenge': [
    { id: 'rounds', label: 'عدد الجولات', value: '٨ جولات' },
    { id: 'speed', label: 'سرعة السؤال', value: 'سريع' },
  ],
  marathon: [
    { id: 'games', label: 'عدد الألعاب', value: '٣ ألعاب' },
    { id: 'order', label: 'ترتيب الألعاب', value: 'عشوائي' },
  ],
};
