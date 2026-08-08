import type { Metadata } from 'next';
import { ContactPageClient } from './contact-page-client';

export const metadata: Metadata = {
  title: 'تواصل معنا',
};

export default function ContactPage() {
  return <ContactPageClient />;
}
