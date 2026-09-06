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
  'الألعاب الجماعية في وناستنا: تعرّف على كل لعبة، كم لاعب تناسب، وكيف تبدأ مع أصحابك من المتصفح.';

export const GAMES_FRIENDS_TITLE = 'ألعاب جماعية للأصدقاء';
export const GAMES_FRIENDS_DESCRIPTION =
  'ألعاب جماعية للأصدقاء من المتصفح: أنشئ غرفة، شارك الرمز، والعبوا على ديسكورد أو من بعيد بدون تسجيل.';

export const GAMES_BROWSER_TITLE = 'ألعاب جماعية بدون تحميل';
export const GAMES_BROWSER_DESCRIPTION =
  'ألعاب جماعية أونلاين بدون تحميل: العب مع أصحابك من المتصفح على الجوال أو الكمبيوتر، بدون تطبيق أو تسجيل.';

export const GAMES_GATHERINGS_TITLE = 'ألعاب سهرات وجمعات';
export const GAMES_GATHERINGS_DESCRIPTION =
  'ألعاب سهرات وجمعات من المتصفح: نقاش ورسم وأسئلة للقروب في البيت أو الاستراحة، بدون تحميل.';

export const FAQ_PAGE_TITLE = 'الأسئلة الشائعة';
export const FAQ_PAGE_DESCRIPTION =
  'كيف تنشئ روم وكيف يدخل أصحابك، وهل تحتاج حساب أو تحميل — إجابات قصيرة عن اللعب في وناستنا.';

export const CONTACT_PAGE_TITLE = 'تواصل معنا';
export const CONTACT_PAGE_DESCRIPTION =
  'الدعم والتواصل مع فريق وناستنا يتم عبر سيرفر Discord الرسمي.';

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
