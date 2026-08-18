import type { Metadata } from 'next';
import { FAQAccordion } from '@/components/public/faq-accordion';
import { PageHero } from '@/components/public/page-hero';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { FAQ_PAGE_DESCRIPTION, FAQ_PAGE_TITLE } from '@/lib/public/seo';

export const metadata: Metadata = {
  title: FAQ_PAGE_TITLE,
  description: FAQ_PAGE_DESCRIPTION,
  alternates: { canonical: '/faq' },
  openGraph: {
    title: `${FAQ_PAGE_TITLE} | ${BRAND_NAME_AR}`,
    description: FAQ_PAGE_DESCRIPTION,
    url: '/faq',
    locale: 'ar',
    siteName: BRAND_NAME_AR,
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: `${FAQ_PAGE_TITLE} | ${BRAND_NAME_AR}`,
    description: FAQ_PAGE_DESCRIPTION,
  },
};

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHero
        title="الأسئلة الشائعة"
        description="إجابات قصيرة عن إنشاء الغرفة، دخول الأصحاب، والحاجة لحساب أو تطبيق."
        variant="compact"
        className="mb-10"
      />
      <FAQAccordion grouped />
    </main>
  );
}
