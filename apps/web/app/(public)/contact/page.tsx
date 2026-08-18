import type { Metadata } from 'next';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { CONTACT_PAGE_DESCRIPTION, CONTACT_PAGE_TITLE } from '@/lib/public/seo';
import { ContactPageClient } from './contact-page-client';

export const metadata: Metadata = {
  title: CONTACT_PAGE_TITLE,
  description: CONTACT_PAGE_DESCRIPTION,
  alternates: { canonical: '/contact' },
  openGraph: {
    title: `${CONTACT_PAGE_TITLE} | ${BRAND_NAME_AR}`,
    description: CONTACT_PAGE_DESCRIPTION,
    url: '/contact',
    locale: 'ar',
    siteName: BRAND_NAME_AR,
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: `${CONTACT_PAGE_TITLE} | ${BRAND_NAME_AR}`,
    description: CONTACT_PAGE_DESCRIPTION,
  },
};

export default function ContactPage() {
  return <ContactPageClient />;
}
