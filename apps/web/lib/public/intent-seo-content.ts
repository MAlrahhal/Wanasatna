import type { PlayableGameId } from '@wanasatna/shared';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { PUBLIC_ROUTES } from '@/lib/public/routes';
import { SITE_ORIGIN } from '@/lib/public/seo';

export type IntentSeoId = 'friends' | 'browser' | 'gatherings';

export type IntentSeoFaq = {
  question: string;
  answer: string;
};

export type IntentRecommendedGame = {
  id: PlayableGameId;
  blurb: string;
};

export type IntentSeoPage = {
  id: IntentSeoId;
  path: string;
  title: string;
  metaDescription: string;
  intro: string;
  useCases: string[];
  recommended: IntentRecommendedGame[];
  faqs: IntentSeoFaq[];
  relatedIntentIds: IntentSeoId[];
};

const pages: Record<IntentSeoId, IntentSeoPage> = {
  friends: {
    id: 'friends',
    path: PUBLIC_ROUTES.gamesFriends,
    title: 'ألعاب جماعية للأصدقاء',
    metaDescription:
      'ألعاب جماعية للأصدقاء من المتصفح: أنشئ غرفة، شارك الرمز، والعبوا على ديسكورد أو من بعيد بدون تسجيل.',
    intro:
      'وناستنا للّي يبون يلعبون مع أصحابهم وهم مو بنفس المكان. الغرفة تتفتح من المتصفح، والرمز يكفي عشان الكل يدخل. ما تحتاجون نفس الجهاز ولا تحميل.',
    useCases: [
      'قروب ديسكورد يبي جولة بعد الدوام.',
      'أصحاب في مدن مختلفة ويبون شيء سريع بدون حسابات.',
      'مكالمة جماعية وتحتاجون لعبة ما تقطع الكلام.',
    ],
    recommended: [
      {
        id: 'bara-al-salafa',
        blurb: 'نقاش صوتي يشتغل زين على السماعة. اللي برا السالفة يحاول يمر مع القروب.',
      },
      {
        id: 'who-wrote-it',
        blurb: 'كل واحد يكتب جملة، وبعدين تخمّنون الأسلوب. تضحك أكثر كل ما كنتم تعرفون بعض.',
      },
      {
        id: 'imposter-draw',
        blurb: 'ترسمون في نفس الوقت وفيكم واحد يتموّه. مناسبة للمكالمة لأن التصويت قصير.',
      },
      {
        id: 'fast-answer',
        blurb: 'أسئلة سريعة لو القروب يبي حركة خفيفة بدون نقاش طويل.',
      },
    ],
    faqs: [
      {
        question: 'كيف يجتمع الأصحاب وهم مو سوا؟',
        answer:
          'واحد ينشئ غرفة من الرئيسية ويشارك رمز الست خانات. الباقي يكتبون الاسم والرمز وينضمون.',
      },
      {
        question: 'نحتاج ديسكورد؟',
        answer:
          'لا. الصوت من عندكم: ديسكورد أو اتصال عادي أو نفس الغرفة. وناستنا تشغّل اللعبة في المتصفح.',
      },
      {
        question: 'فيه ألعاب لشخصين بس؟',
        answer:
          'تحدي التخمين يحتاج ٢ أو ٤. أسرع إجابة وتحدي التوقيت يشتغلون من لاعبين اثنين. برا السالفة والقاضي يحتاجون ثلاثة على الأقل.',
      },
    ],
    relatedIntentIds: ['browser', 'gatherings'],
  },
  browser: {
    id: 'browser',
    path: PUBLIC_ROUTES.gamesBrowser,
    title: 'ألعاب جماعية بدون تحميل',
    metaDescription:
      'ألعاب جماعية أونلاين بدون تحميل: العب مع أصحابك من المتصفح على الجوال أو الكمبيوتر، بدون تطبيق أو تسجيل.',
    intro:
      'كل ألعاب وناستنا تفتح في المتصفح. ما فيه متجر ولا ملف تثبيت. نفس الصفحة تشتغل أونلاين: تنشئ غرفة، تدخلون برمز، وتختارون اللعبة من اللوبي.',
    useCases: [
      'جوال ما تبي تحط عليه تطبيق ألعاب.',
      'كمبيوتر مشترك أو جهاز ضيف وتبون تلعبون فورًا.',
      'قروب يبي أونلاين من غير ما الكل يحمّل نفس البرنامج.',
    ],
    recommended: [
      {
        id: 'fast-answer',
        blurb: 'أسئلة في الصفحة. الكتابة على الجوال كافية، وما تحتاج لوحة رسم.',
      },
      {
        id: 'timing-challenge',
        blurb: 'مؤقت داخل المتصفح. جولة قصيرة لو الشبكة بطيئة والكل على بيانات الجوال.',
      },
      {
        id: 'draw-guess',
        blurb: 'لوحة الرسم في الصفحة. تشتغل باللمس أو الماوس بدون برنامج رسم.',
      },
      {
        id: 'guessing-challenge',
        blurb: 'مواجهة ٢ أو ٤ داخل المتصفح. مناسبة لو العدد مضبوط وما تبون روم كبير.',
      },
    ],
    faqs: [
      {
        question: 'الحق أونلاين ولا لازم نكون على نفس الشبكة؟',
        answer:
          'اللعب أونلاين عبر الغرفة. كل واحد يفتح الموقع من مكانه ما دام يقدر يدخل بالرمز.',
      },
      {
        question: 'في تطبيق لأندرويد أو آيفون؟',
        answer: 'لا. افتح الموقع من متصفح الجوال. ما فيه تحميل من المتجر.',
      },
      {
        question: 'التسجيل مطلوب عشان اللعب من المتصفح؟',
        answer: 'لا. اكتب اسمك وادخل الغرفة. الحساب اختياري وما يوقف اللعب.',
      },
    ],
    relatedIntentIds: ['friends', 'gatherings'],
  },
  gatherings: {
    id: 'gatherings',
    path: PUBLIC_ROUTES.gamesGatherings,
    title: 'ألعاب سهرات وجمعات',
    metaDescription:
      'ألعاب سهرات وجمعات من المتصفح: نقاش ورسم وأسئلة للقروب في البيت أو الاستراحة، بدون تحميل.',
    intro:
      'هالصفحة للّي يجتمعون في مكان واحد ويبون شيء يتحرك على الشاشة أو على الجوالات. وناستنا ما تستبدل السالفة؛ تعطون الرمز للي في المجلس وتبدؤون.',
    useCases: [
      'سهرة في البيت والجوالات عند الكل.',
      'استراحة دوام وتبون جولة قصيرة قبل ما يتفرق القروب.',
      'تجمّع عائلي تبيه ألعاب كلام ورسم مو منصات إطلاق نار.',
    ],
    recommended: [
      {
        id: 'judge',
        blurb: 'القاضي في المجلس يختار الإجابة اللي تعجبه. الضحك على الذوق مو على الحفظ.',
      },
      {
        id: 'who-wrote-it',
        blurb: 'تمرّرون الجمل على بعض وتحزرون الكاتب. تشتغل زين لما القروب يعرف بعض.',
      },
      {
        id: 'bara-al-salafa',
        blurb: 'نقاش بصوت عالٍ. اللي برا السالفة يحاول يمر قدام اللي في الصالة.',
      },
      {
        id: 'draw-guess',
        blurb: 'ارسموا على الجوال أو كمبيوتر متصل بالشاشة، والباقي يخمّنون من الصالة.',
      },
    ],
    faqs: [
      {
        question: 'نقدر نلعب على شاشة واحدة؟',
        answer:
          'الغرفة واحدة، وكل لاعب يحتاج يفتح الصفحة باسمه عشان يشوف دوره أو يكتب. الشاشة المشتركة تفيد للرسم أو عرض النتائج، مو كبديل عن أجهزة اللاعبين في كل الألعاب.',
      },
      {
        question: 'كم شخص يناسب السهرة؟',
        answer:
          'الغرفة العامة تتسع حتى ثمانية حسب اللعبة. تحدي التخمين يبقى ٢ أو ٤. لجمعات أكبر وزّعوا جولات أو غرفتين.',
      },
      {
        question: 'في ألعاب تهدأ المجلس أكثر من الأسئلة السريعة؟',
        answer: 'برا السالفة ومن كتبها؟ والقاضي أهدأ. أسرع إجابة وتحدي التوقيت أسرع وأقصر.',
      },
    ],
    relatedIntentIds: ['friends', 'browser'],
  },
};

export function listIntentSeoPages(): IntentSeoPage[] {
  return [pages.friends, pages.browser, pages.gatherings];
}

export function getIntentSeoPage(id: IntentSeoId): IntentSeoPage {
  return pages[id];
}

export function buildIntentPageJsonLd(page: IntentSeoPage) {
  const url = `${SITE_ORIGIN}${page.path}`;

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      description: page.metaDescription,
      url,
      inLanguage: 'ar',
      isPartOf: {
        '@type': 'WebSite',
        name: BRAND_NAME_AR,
        url: `${SITE_ORIGIN}/`,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'الرئيسية',
          item: `${SITE_ORIGIN}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'الألعاب',
          item: `${SITE_ORIGIN}${PUBLIC_ROUTES.games}`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: page.title,
          item: url,
        },
      ],
    },
  ];
}

