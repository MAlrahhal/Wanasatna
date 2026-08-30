import type { Metadata } from 'next';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import {
  buildPublicSocialMetadata,
  GAMES_PAGE_DESCRIPTION,
  GAMES_PAGE_TITLE,
} from '@/lib/public/seo';
import { GamesPageClient } from './games-page-client';

export const metadata: Metadata = {
  title: GAMES_PAGE_TITLE,
  description: GAMES_PAGE_DESCRIPTION,
  alternates: { canonical: '/games' },
  ...buildPublicSocialMetadata({
    title: `${GAMES_PAGE_TITLE} | ${BRAND_NAME_AR}`,
    description: GAMES_PAGE_DESCRIPTION,
    url: '/games',
  }),
};

export default function GamesPage() {
  return <GamesPageClient />;
}
