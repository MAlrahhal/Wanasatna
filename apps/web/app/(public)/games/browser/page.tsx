import type { Metadata } from 'next';
import { IntentLandingPage } from '@/components/public/intent-landing-page';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { buildIntentPageJsonLd, getIntentSeoPage } from '@/lib/public/intent-seo-content';
import { PUBLIC_ROUTES } from '@/lib/public/routes';
import {
  GAMES_BROWSER_DESCRIPTION,
  GAMES_BROWSER_TITLE,
  buildPublicSocialMetadata,
} from '@/lib/public/seo';

const page = getIntentSeoPage('browser');

export const metadata: Metadata = {
  title: GAMES_BROWSER_TITLE,
  description: GAMES_BROWSER_DESCRIPTION,
  alternates: { canonical: PUBLIC_ROUTES.gamesBrowser },
  ...buildPublicSocialMetadata({
    title: `${GAMES_BROWSER_TITLE} | ${BRAND_NAME_AR}`,
    description: GAMES_BROWSER_DESCRIPTION,
    url: PUBLIC_ROUTES.gamesBrowser,
  }),
};

export default function GamesBrowserPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildIntentPageJsonLd(page)) }}
      />
      <IntentLandingPage page={page} />
    </>
  );
}
