import { BRAND_NAME_AR } from '@/lib/public/brand';
import { PUBLIC_ROUTES, getGameInformationPath } from '@/lib/public/routes';
import { SITE_ORIGIN } from '@/lib/public/seo';

export type FaqCategory = 'play' | 'account' | 'technical';

export type FaqRelatedLink = {
  href: string;
  label: string;
};

export type FaqItem = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  relatedLinks?: FaqRelatedLink[];
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
    answer:
      'لا تحتاج حسابًا للعب. اكتب اسمك وادخل الغرفة. الحساب اختياري، وما يوقف إنشاء الغرفة أو الانضمام برمز.',
  },
  {
    id: 'create-room',
    category: 'play',
    question: 'كيف أنشئ غرفة؟',
    answer:
      'من الصفحة الرئيسية، اكتب اسمك في بطاقة إنشاء الغرفة واضغط إنشاء. يوصلك اللوبي، وهناك تشارك رمز الغرفة مع أصحابك وتختارون اللعبة.',
  },
  {
    id: 'join-room',
    category: 'play',
    question: 'كيف يدخل أصحابي؟',
    answer:
      'يكتبون اسمهم ورمز الغرفة المكوّن من 6 خانات في بطاقة الانضمام على الصفحة الرئيسية. بعد الدخول يظهرون في نفس اللوبي.',
  },
  {
    id: 'no-download',
    category: 'play',
    question: 'هل أحتاج تحميل؟',
    answer:
      'لا. اللعب من المتصفح على الجوال أو الكمبيوتر. بعض الألعاب تحتاج لمس أو ماوس للرسم، والباقي كتابة أو ضغط داخل الصفحة.',
    relatedLinks: [
      { href: PUBLIC_ROUTES.gamesBrowser, label: 'ألعاب المتصفح حسب أسلوب اللعب' },
    ],
  },
  {
    id: 'player-count',
    category: 'play',
    question: 'كم لاعب يقدر يدخل؟',
    answer:
      'الغرفة العامة تتسع حتى ٨ لاعبين، حسب اللعبة. برا السالفة والإمبوستر بالرسم ومن كتبها؟ والقاضي يحتاجون ٣ على الأقل. أسرع إجابة وتحدي التوقيت وارسم وخمّن يشتغلون من اثنين. تحدي التخمين يحتاج ٢ أو ٤ لاعبين نشطين فقط.',
    relatedLinks: [
      { href: PUBLIC_ROUTES.games, label: 'جدول اختيار اللعبة' },
      { href: getGameInformationPath('guessing-challenge'), label: 'تحدي التخمين' },
    ],
  },
  {
    id: 'choose-game',
    category: 'play',
    question: 'كيف نختار لعبة مناسبة؟',
    answer:
      'ابدأوا بعددكم: اثنان يناسبان أسرع إجابة أو تحدي التوقيت أو ارسم وخمّن أو تحدي التخمين. ثلاثة وفوق يفتحون برا السالفة والقاضي ومن كتبها؟ والإمبوستر بالرسم. لو تبون نقاش خذوا برا السالفة؛ لو تبون قاضي يختار مو تصويت جماعي خذوا القاضي.',
    relatedLinks: [{ href: PUBLIC_ROUTES.games, label: 'كل الألعاب' }],
  },
  {
    id: 'mobile',
    category: 'play',
    question: 'هل يعمل على الجوال؟',
    answer:
      'نعم. تشتغل من المتصفح على الجوال والكمبيوتر. الرسم باللمس في ارسم وخمّن والإمبوستر بالرسم، والكتابة تكفي لباقي الألعاب.',
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
      'حاول تفتح الرابط مرة ثانية أو تنضم برمز الغرفة إذا الغرفة ما زالت مفتوحة. قد تحتاج تدخل باسمك من جديد عشان يرجع الاتصال.',
  },
  {
    id: 'contact-support',
    category: 'technical',
    question: 'كيف أبلغ عن مشكلة؟',
    answer:
      'التواصل الحالي عبر سيرفر Discord الرسمي. عند الإبلاغ، اذكر اسم اللعبة ووش كنت تسوي والجهاز أو المتصفح إذا قدرت.',
    relatedLinks: [{ href: PUBLIC_ROUTES.contact, label: 'صفحة التواصل' }],
  },
];

export function buildFaqPageJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    name: 'الأسئلة الشائعة',
    inLanguage: 'ar',
    isPartOf: {
      '@type': 'WebSite',
      name: BRAND_NAME_AR,
      url: `${SITE_ORIGIN}/`,
    },
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
