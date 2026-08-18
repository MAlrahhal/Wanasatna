import type { Metadata } from 'next';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { GAMES_PAGE_DESCRIPTION, GAMES_PAGE_TITLE } from '@/lib/public/seo';
import { GamesPageClient } from './games-page-client';

export const metadata: Metadata = {
  title: GAMES_PAGE_TITLE,
  description: GAMES_PAGE_DESCRIPTION,
  alternates: { canonical: '/games' },
  openGraph: {
    title: `${GAMES_PAGE_TITLE} | ${BRAND_NAME_AR}`,
    description: GAMES_PAGE_DESCRIPTION,
    url: '/games',
    locale: 'ar',
    siteName: BRAND_NAME_AR,
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: `${GAMES_PAGE_TITLE} | ${BRAND_NAME_AR}`,
    description: GAMES_PAGE_DESCRIPTION,
  },
};

export default function GamesPage() {
  return <GamesPageClient />;
}
