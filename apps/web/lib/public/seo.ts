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

export const FAQ_PAGE_TITLE = 'الأسئلة الشائعة';
export const FAQ_PAGE_DESCRIPTION =
  'كيف تنشئ روم وكيف يدخل أصحابك، وهل تحتاج حساب أو تحميل — إجابات قصيرة عن اللعب في وناستنا.';

export const CONTACT_PAGE_TITLE = 'تواصل معنا';
export const CONTACT_PAGE_DESCRIPTION =
  'الدعم والتواصل مع فريق وناستنا يتم عبر سيرفر Discord الرسمي.';

export const INDEXABLE_PUBLIC_PATHS = [
  PUBLIC_ROUTES.home,
  PUBLIC_ROUTES.games,
  PUBLIC_ROUTES.faq,
  PUBLIC_ROUTES.contact,
] as const;

export const GAME_INFORMATION_PATHS = PLAYABLE_GAME_IDS.map((gameId) =>
  getGameInformationPath(gameId),
);

export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: BRAND_NAME_AR,
  url: `${SITE_ORIGIN}/`,
  inLanguage: 'ar',
  description: HOME_DESCRIPTION,
} as const;
