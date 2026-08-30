import type { Metadata } from 'next';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import {
  buildPublicSocialMetadata,
  CONTACT_PAGE_DESCRIPTION,
  CONTACT_PAGE_TITLE,
} from '@/lib/public/seo';
import { ContactPageClient } from './contact-page-client';

export const metadata: Metadata = {
  title: CONTACT_PAGE_TITLE,
  description: CONTACT_PAGE_DESCRIPTION,
  alternates: { canonical: '/contact' },
  ...buildPublicSocialMetadata({
    title: `${CONTACT_PAGE_TITLE} | ${BRAND_NAME_AR}`,
    description: CONTACT_PAGE_DESCRIPTION,
    url: '/contact',
  }),
};

export default function ContactPage() {
  return <ContactPageClient />;
}
