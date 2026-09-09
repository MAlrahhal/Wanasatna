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

export type IntentChooserRow = {
  id: PlayableGameId;
  players: string;
  note: string;
};

export type IntentSeoPage = {
  id: IntentSeoId;
  path: string;
  title: string;
  metaDescription: string;
  intro: string;
  useCases: string[];
  chooserTitle: string;
  chooserIntro: string;
  chooserColumns: readonly [string, string, string];
  chooserRows: IntentChooserRow[];
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
      'ألعاب جماعية للأصدقاء عن بُعد: اختر حسب العدد والنقاش أو الجولات السريعة، ثم ابدأ غرفة من المتصفح.',
    intro:
      'هذي الصفحة لو القروب مو في نفس المكان: مكالمة، ديسكورد، أو كل واحد في مدينة. اللعبة في المتصفح، والصوت من عندكم إذا احتجتموه.',
    useCases: [
      'قروب ديسكورد يبي جولة بعد الدوام.',
      'أصحاب في مدن مختلفة ويبون شيء مشترك بدون ما يجتمعون في جهاز واحد.',
      'مكالمة جماعية وتحتاجون لعبة ما تقطع الكلام، أو جولة سريعة بدون نقاش.',
    ],
    chooserTitle: 'كيف تختارون وأنتم عن بُعد؟',
    chooserIntro: 'ابدأوا بعدد اللاعبين، بعدين هل تبون نقاش ولا جولة سريعة.',
    chooserColumns: ['اللعبة', 'العدد', 'عن بُعد'],
    chooserRows: [
      {
        id: 'bara-al-salafa',
        players: '٣–٨',
        note: 'نقاش. صوت المكالمة يفيد للأسئلة والتصويت.',
      },
      {
        id: 'who-wrote-it',
        players: '٣–٨',
        note: 'كتابة ثم تخمين الأسلوب. تضحك أكثر لو تعرفون بعض.',
      },
      {
        id: 'imposter-draw',
        players: '٣–٨',
        note: 'رسم بالدور على لوحة واحدة، ثم تصويت قصير.',
      },
      {
        id: 'fast-answer',
        players: '٢–٨',
        note: 'أسئلة سريعة. تشتغل حتى بدون نقاش طويل.',
      },
      {
        id: 'guessing-challenge',
        players: '٢ أو ٤',
        note: 'مواجهة 1 ضد 1 أو 2 ضد 2 فقط.',
      },
      {
        id: 'timing-challenge',
        players: '٢–٨',
        note: 'إحساس بالوقت. ما تحتاجون صوت.',
      },
    ],
    recommended: [
      {
        id: 'bara-al-salafa',
        blurb: 'إذا السماعة شغالة: أسئلة موجهة ثم حرة ثم تصويت على مين برا السالفة.',
      },
      {
        id: 'who-wrote-it',
        blurb: 'كل واحد يكتب جملة، وبعدين تخمّنون الأسلوب. تصلح للمكالمة لأن الكتابة تتم على الجهاز.',
      },
      {
        id: 'imposter-draw',
        blurb: 'ترسمون بالدور على نفس اللوحة وفيكم واحد يتموّه. التصويت بعد الرسم.',
      },
      {
        id: 'fast-answer',
        blurb: 'لو القروب يبي حركة خفيفة: أول إجابة صحيحة تقفل الجولة.',
      },
    ],
    faqs: [
      {
        question: 'كم لاعب يناسب اللعب عن بُعد؟',
        answer:
          'تحدي التخمين اثنين أو أربعة فقط. أسرع إجابة وتحدي التوقيت وارسم وخمّن يشتغلون من اثنين. برا السالفة والقاضي ومن كتبها؟ والإمبوستر بالرسم يحتاجون ثلاثة على الأقل.',
      },
      {
        question: 'نحتاج ديسكورد؟',
        answer:
          'لا كشرط للعبة. الصوت من عندكم إذا اللعبة تحتاج نقاش، مثل برا السالفة. تحدي التوقيت وأسرع إجابة يشتغلون بدون مكالمة.',
      },
      {
        question: 'نقاش طويل ولا جولة سريعة؟',
        answer:
          'برا السالفة ومن كتبها؟ والقاضي أهدأ وأطول في الكلام. أسرع إجابة وتحدي التوقيت أقصر. الإمبوستر بالرسم بينهما: رسم ثم تصويت.',
      },
    ],
    relatedIntentIds: ['browser', 'gatherings'],
  },
  browser: {
    id: 'browser',
    path: PUBLIC_ROUTES.gamesBrowser,
    title: 'ألعاب جماعية بدون تحميل',
    metaDescription:
      'ألعاب وناستنا من المتصفح: رسم باللمس، كتابة للأسئلة، ومؤقت داخل الصفحة — بدون متجر تطبيقات.',
    intro:
      'الألعاب تفتح في تبويب المتصفح على الجوال أو الكمبيوتر. الفرق بين الألعاب هو أسلوب التفاعل: رسم، كتابة، توقيت، أو أسئلة نعم/لا — مو وجود تطبيق منفصل.',
    useCases: [
      'جوال ما تبي تحط عليه تطبيق ألعاب.',
      'كمبيوتر مشترك أو جهاز ضيف وتبون تدخلون من المتصفح.',
      'قروب كل واحد على جهاز مختلف ونفس الموقع يكفي.',
    ],
    chooserTitle: 'وش يناسب جهازك؟',
    chooserIntro: 'اختاروا حسب اللي ترتاحون تسوونه على الشاشة، مو حسب وجود تطبيق.',
    chooserColumns: ['اللعبة', 'التفاعل', 'على الجهاز'],
    chooserRows: [
      {
        id: 'draw-guess',
        players: 'رسم',
        note: 'لوحة في الصفحة. تشتغل باللمس أو الماوس.',
      },
      {
        id: 'imposter-draw',
        players: 'رسم بالدور',
        note: 'نفس اللوحة للكل. كل دور إضافة قصيرة.',
      },
      {
        id: 'fast-answer',
        players: 'كتابة',
        note: 'لوحة المفاتيح أو كيبورد الجوال تكفي.',
      },
      {
        id: 'who-wrote-it',
        players: 'كتابة',
        note: 'جمل قصيرة ثم تخمين على الشاشة.',
      },
      {
        id: 'judge',
        players: 'كتابة + اختيار',
        note: 'القاضي يختار من قائمة إجابات على جهازه.',
      },
      {
        id: 'timing-challenge',
        players: 'مؤقت',
        note: 'ضغط داخل الصفحة. ما تحتاج لوحة رسم.',
      },
      {
        id: 'guessing-challenge',
        players: 'نعم/لا',
        note: 'أسئلة قصيرة. العدد لازم ٢ أو ٤.',
      },
    ],
    recommended: [
      {
        id: 'fast-answer',
        blurb: 'أسئلة في الصفحة. الكتابة على الجوال كافية، وما تحتاج لوحة رسم.',
      },
      {
        id: 'timing-challenge',
        blurb: 'مؤقت داخل المتصفح. مناسب لو ما تبون رسم ولا جمل طويلة.',
      },
      {
        id: 'draw-guess',
        blurb: 'لوحة الرسم في الصفحة. تشتغل باللمس أو الماوس.',
      },
      {
        id: 'guessing-challenge',
        blurb: 'مواجهة ٢ أو ٤ داخل المتصفح. أسئلة نعم أو لا بدل كتابة فقرة.',
      },
    ],
    faqs: [
      {
        question: 'الرسم على الجوال غير الكتابة؟',
        answer:
          'نعم. ارسم وخمّن والإمبوستر بالرسم يحتاجون لمس أو ماوس على اللوحة. أسرع إجابة ومن كتبها؟ والقاضي تعتمد على الكتابة. تحدي التوقيت ضغطة مؤقت.',
      },
      {
        question: 'لازم نكون على نفس الشبكة؟',
        answer: 'لا. كل واحد يفتح الموقع من مكانه ويدخل نفس الغرفة.',
      },
      {
        question: 'في تطبيق لأندرويد أو آيفون؟',
        answer: 'لا. افتح الموقع من متصفح الجوال. الحساب اختياري وما يوقف اللعب.',
      },
    ],
    relatedIntentIds: ['friends', 'gatherings'],
  },
  gatherings: {
    id: 'gatherings',
    path: PUBLIC_ROUTES.gamesGatherings,
    title: 'ألعاب سهرات وجمعات',
    metaDescription:
      'ألعاب سهرات: متى تكفي شاشة مشتركة، ومتى كل واحد يحتاج جهازه — حسب الرسم والقاضي والأدوار المخفية.',
    intro:
      'هالصفحة للّي يجتمعون في مكان واحد. الغرفة واحدة، بس بعض الألعاب تحتاج كل لاعب يفتح الصفحة باسمه عشان يشوف دوره أو يكتب.',
    useCases: [
      'سهرة في البيت والجوالات عند الكل.',
      'استراحة وتبون جولة قبل ما يتفرق القروب.',
      'تجمّع تبيه كلام ورسم مو ألعاب حركة.',
    ],
    chooserTitle: 'شاشة مشتركة ولا جهاز لكل لاعب؟',
    chooserIntro:
      'الشاشة الكبيرة تفيد للعرض. الأدوار المخفية والكتابة تحتاج جهاز لكل مشارك.',
    chooserColumns: ['اللعبة', 'الأجهزة', 'في المجلس'],
    chooserRows: [
      {
        id: 'draw-guess',
        players: 'شاشة تفيد',
        note: 'الكل يقدر يتفرج على الرسمة. كل خمّن ما زال يحتاج يكتب من جهازه.',
      },
      {
        id: 'imposter-draw',
        players: 'أجهزة فردية',
        note: 'الدور والصورة المرجعية ما تنعرض للكل بنفس الشكل.',
      },
      {
        id: 'bara-al-salafa',
        players: 'أجهزة فردية',
        note: 'الكلمة والدور سريان. الصوت في المجلس يكفي للنقاش.',
      },
      {
        id: 'judge',
        players: 'أجهزة فردية',
        note: 'كل كاتب يكتب من جهازه. القاضي يختار على جهازه.',
      },
      {
        id: 'who-wrote-it',
        players: 'أجهزة فردية',
        note: 'كل واحد يكتب ثم يخمن. النتائج تصلح للعرض.',
      },
      {
        id: 'guessing-challenge',
        players: '٢ أو ٤ أجهزة',
        note: 'الهوية مخفية عن صاحبها. ما تلعبونها بثمانية في نفس الغرفة.',
      },
    ],
    recommended: [
      {
        id: 'judge',
        blurb: 'القاضي في المجلس يختار الإجابة اللي تعجبه. الضحك على الذوق مو على الحفظ.',
      },
      {
        id: 'who-wrote-it',
        blurb: 'تمرّرون الجمل وتحزرون الكاتب. تشتغل زين لما القروب يعرف بعض.',
      },
      {
        id: 'bara-al-salafa',
        blurb: 'نقاش بصوت عالٍ. اللي برا السالفة يحاول يمر قدام اللي في الصالة.',
      },
      {
        id: 'draw-guess',
        blurb: 'ارسموا على جهاز متصل بالشاشة إن حبيتوا، والباقي يخمّنون من أجهزتهم.',
      },
    ],
    faqs: [
      {
        question: 'نقدر نلعب على شاشة واحدة فقط؟',
        answer:
          'الشاشة المشتركة تفيد للرسم أو عرض النتائج. في معظم الألعاب كل لاعب يحتاج يفتح الصفحة باسمه عشان يشوف دوره أو يكتب. الأدوار المخفية ما تنلعب من شاشة واحدة للكل.',
      },
      {
        question: 'كم شخص يناسب السهرة؟',
        answer:
          'الغرفة العامة تتسع حتى ثمانية حسب اللعبة. تحدي التخمين يبقى ٢ أو ٤. لجمعات أكبر وزّعوا جولات أو غرفتين.',
      },
      {
        question: 'أي الألعاب أهدأ في المجلس؟',
        answer:
          'برا السالفة ومن كتبها؟ والقاضي أهدأ في الإيقاع. أسرع إجابة وتحدي التوقيت أقصر وأعلى حركة.',
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
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faqs.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
  ];
}
