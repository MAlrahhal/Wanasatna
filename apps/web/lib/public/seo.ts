import type { Metadata } from 'next';
import { PLAYABLE_GAME_IDS } from '@wanasatna/shared';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { PUBLIC_ROUTES, getGameInformationPath } from '@/lib/public/routes';

export const SITE_ORIGIN = 'https://wanasatna.com';

export const HOME_TITLE = 'وناستنا | ألعاب جماعية عربية للأصدقاء';

export const HOME_DESCRIPTION =
  'العب ألعاب جماعية عربية مع أصحابك من المتصفح — مناسبة للتجمعات وديسكورد، بدون تسجيل.';

export const TITLE_TEMPLATE = `%s | ${BRAND_NAME_AR}`;

export const GAMES_PAGE_TITLE = 'الألعاب الجماعية';
export const GAMES_PAGE_DESCRIPTION =
  'قارن ألعاب وناستنا حسب العدد وأسلوب اللعب، ثم افتح صفحة كل لعبة واقرأ كيف تشتغل قبل ما تبدؤون.';

export const GAMES_FRIENDS_TITLE = 'ألعاب جماعية للأصدقاء';
export const GAMES_FRIENDS_DESCRIPTION =
  'ألعاب جماعية للأصدقاء عن بُعد: اختر حسب العدد والنقاش أو الجولات السريعة، ثم ابدأ غرفة من المتصفح.';

export const GAMES_BROWSER_TITLE = 'ألعاب جماعية بدون تحميل';
export const GAMES_BROWSER_DESCRIPTION =
  'ألعاب وناستنا من المتصفح: رسم باللمس، كتابة للأسئلة، ومؤقت داخل الصفحة — بدون متجر تطبيقات.';

export const GAMES_GATHERINGS_TITLE = 'ألعاب سهرات وجمعات';
export const GAMES_GATHERINGS_DESCRIPTION =
  'ألعاب سهرات: متى تكفي شاشة مشتركة، ومتى كل واحد يحتاج جهازه — حسب الرسم والقاضي والأدوار المخفية.';

export const ABOUT_PAGE_TITLE = 'عن وناستنا';
export const ABOUT_PAGE_DESCRIPTION =
  'تعرّف على وناستنا: منصة ألعاب جماعية عربية من المتصفح، وكيف تشتغل الغرفة مع الأصدقاء.';

export const FAQ_PAGE_TITLE = 'الأسئلة الشائعة';
export const FAQ_PAGE_DESCRIPTION =
  'كيف تنشئ غرفة، كيف يدخل أصحابك، وهل تحتاج حساب أو تطبيق — إجابات عن اللعب في وناستنا.';

export const CONTACT_PAGE_TITLE = 'تواصل معنا';
export const CONTACT_PAGE_DESCRIPTION =
  'تواصل مع وناستنا عبر سيرفر Discord الرسمي للإبلاغ عن مشكلة أو إرسال ملاحظة.';

export const PRIVACY_PAGE_TITLE = 'سياسة الخصوصية';
export const PRIVACY_PAGE_DESCRIPTION =
  'تعرّف على البيانات التي تعالجها وناستنا لتشغيل الغرف والألعاب والحسابات، وكيف تُستخدم وتُحفظ.';

export const TERMS_PAGE_TITLE = 'الشروط والأحكام';
export const TERMS_PAGE_DESCRIPTION =
  'شروط استخدام منصة وناستنا للألعاب الجماعية، وقواعد الاستخدام والتواصل والمسؤوليات الأساسية.';

export const SOCIAL_IMAGE = {
  url: '/brand/wanasatna-og.png',
  width: 1200,
  height: 630,
  alt: `${BRAND_NAME_AR} (Wanasatna)`,
} as const;

export function buildPublicSocialMetadata({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  return {
    openGraph: {
      title,
      description,
      url,
      locale: 'ar',
      siteName: BRAND_NAME_AR,
      type: 'website',
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [SOCIAL_IMAGE],
    },
  } satisfies Pick<Metadata, 'openGraph' | 'twitter'>;
}

export const INDEXABLE_PUBLIC_PATHS = [
  PUBLIC_ROUTES.home,
  PUBLIC_ROUTES.games,
  PUBLIC_ROUTES.gamesFriends,
  PUBLIC_ROUTES.gamesBrowser,
  PUBLIC_ROUTES.gamesGatherings,
  PUBLIC_ROUTES.about,
  PUBLIC_ROUTES.faq,
  PUBLIC_ROUTES.contact,
  PUBLIC_ROUTES.privacy,
  PUBLIC_ROUTES.terms,
] as const;

export const GAME_INFORMATION_PATHS = PLAYABLE_GAME_IDS.map((gameId) =>
  getGameInformationPath(gameId),
);

export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: BRAND_NAME_AR,
  alternateName: 'Wanasatna',
  url: `${SITE_ORIGIN}/`,
  inLanguage: 'ar',
  description: HOME_DESCRIPTION,
} as const;
