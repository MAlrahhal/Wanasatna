import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { HOME_DESCRIPTION, HOME_TITLE, websiteJsonLd } from '@/lib/public/seo';
import { HomePageClient } from './home-page-client';

export const metadata: Metadata = {
  title: {
    absolute: HOME_TITLE,
  },
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
    openGraph: {
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      url: '/',
      locale: 'ar',
      siteName: BRAND_NAME_AR,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
    },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <Suspense fallback={null}>
        <HomePageClient />
      </Suspense>
    </>
  );
}
