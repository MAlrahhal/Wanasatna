import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
  buildPublicSocialMetadata,
  HOME_DESCRIPTION,
  HOME_TITLE,
  websiteJsonLd,
} from '@/lib/public/seo';
import { HomePageClient } from './home-page-client';

export const metadata: Metadata = {
  title: {
    absolute: HOME_TITLE,
  },
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  ...buildPublicSocialMetadata({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: '/',
  }),
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
