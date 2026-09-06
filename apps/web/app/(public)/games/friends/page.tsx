import type { Metadata } from 'next';
import { IntentLandingPage } from '@/components/public/intent-landing-page';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { buildIntentPageJsonLd, getIntentSeoPage } from '@/lib/public/intent-seo-content';
import { PUBLIC_ROUTES } from '@/lib/public/routes';
import {
  GAMES_FRIENDS_DESCRIPTION,
  GAMES_FRIENDS_TITLE,
  buildPublicSocialMetadata,
} from '@/lib/public/seo';

const page = getIntentSeoPage('friends');

export const metadata: Metadata = {
  title: GAMES_FRIENDS_TITLE,
  description: GAMES_FRIENDS_DESCRIPTION,
  alternates: { canonical: PUBLIC_ROUTES.gamesFriends },
  ...buildPublicSocialMetadata({
    title: `${GAMES_FRIENDS_TITLE} | ${BRAND_NAME_AR}`,
    description: GAMES_FRIENDS_DESCRIPTION,
    url: PUBLIC_ROUTES.gamesFriends,
  }),
};

export default function GamesFriendsPage() {
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
