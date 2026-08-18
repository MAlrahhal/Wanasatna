export type FaqCategory = 'play' | 'account' | 'technical';

export type FaqItem = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
};

export const faqCategories: { id: FaqCategory; label: string }[] = [
  { id: 'play', label: 'اللعب والغرف' },
  { id: 'account', label: 'بدون حساب' },
  { id: 'technical', label: 'المشاكل التقنية' },
];

export const faqItems: FaqItem[] = [
  {
    id: 'account-required',
    category: 'account',
    question: 'هل أحتاج أسجل حساب؟',
    answer: 'لا تحتاج حسابًا للعب. اكتب اسمك وادخل الغرفة.',
  },
  {
    id: 'create-room',
    category: 'play',
    question: 'كيف أنشئ غرفة؟',
    answer:
      'من الصفحة الرئيسية، اكتب اسمك في بطاقة إنشاء الغرفة واضغط إنشاء. يوصلك اللوبي، وهناك تشارك رمز الغرفة مع أصحابك.',
  },
  {
    id: 'join-room',
    category: 'play',
    question: 'كيف يدخل أصحابي؟',
    answer:
      'يكتبون اسمهم ورمز الغرفة المكوّن من 6 أرقام في بطاقة الانضمام على الصفحة الرئيسية.',
  },
  {
    id: 'no-download',
    category: 'play',
    question: 'هل أحتاج تحميل؟',
    answer: 'لا. اللعب من المتصفح على الجوال أو الكمبيوتر، بدون تطبيق.',
  },
  {
    id: 'player-count',
    category: 'play',
    question: 'كم لاعب يقدر يدخل؟',
    answer:
      'الغرفة العامة تتسع حتى ٨ لاعبين، حسب اللعبة. تحدي التخمين يحتاج ٢ أو ٤ لاعبين نشطين فقط.',
  },
  {
    id: 'mobile',
    category: 'play',
    question: 'هل يعمل على الجوال؟',
    answer: 'نعم. تشتغل من المتصفح على الجوال والكمبيوتر.',
  },
  {
    id: 'free-play',
    category: 'play',
    question: 'هل اللعب مجاني؟',
    answer: 'نعم. تقدر تلعب بدون تسجيل.',
  },
  {
    id: 'disconnect',
    category: 'technical',
    question: 'ماذا يحدث إذا انقطع الاتصال؟',
    answer:
      'حاول تفتح الرابط مرة ثانية أو تنضم برمز الغرفة. قد تحتاج تدخل باسمك من جديد عشان يرجع الاتصال.',
  },
];
