import type { Metadata } from 'next';
import { IntentLandingPage } from '@/components/public/intent-landing-page';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { buildIntentPageJsonLd, getIntentSeoPage } from '@/lib/public/intent-seo-content';
import { PUBLIC_ROUTES } from '@/lib/public/routes';
import {
  GAMES_GATHERINGS_DESCRIPTION,
  GAMES_GATHERINGS_TITLE,
  buildPublicSocialMetadata,
} from '@/lib/public/seo';

const page = getIntentSeoPage('gatherings');

export const metadata: Metadata = {
  title: GAMES_GATHERINGS_TITLE,
  description: GAMES_GATHERINGS_DESCRIPTION,
  alternates: { canonical: PUBLIC_ROUTES.gamesGatherings },
  ...buildPublicSocialMetadata({
    title: `${GAMES_GATHERINGS_TITLE} | ${BRAND_NAME_AR}`,
    description: GAMES_GATHERINGS_DESCRIPTION,
    url: PUBLIC_ROUTES.gamesGatherings,
  }),
};

export default function GamesGatheringsPage() {
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
