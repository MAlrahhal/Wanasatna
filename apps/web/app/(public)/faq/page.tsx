import type { Metadata } from 'next';
import { FAQAccordion } from '@/components/public/faq-accordion';
import { PageHero } from '@/components/public/page-hero';
import { SeoBreadcrumb } from '@/components/public/seo-breadcrumb';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { buildFaqPageJsonLd } from '@/lib/public/faq-data';
import { PUBLIC_ROUTES } from '@/lib/public/routes';
import { buildPublicSocialMetadata, FAQ_PAGE_DESCRIPTION, FAQ_PAGE_TITLE } from '@/lib/public/seo';

export const metadata: Metadata = {
  title: FAQ_PAGE_TITLE,
  description: FAQ_PAGE_DESCRIPTION,
  alternates: { canonical: '/faq' },
  ...buildPublicSocialMetadata({
    title: `${FAQ_PAGE_TITLE} | ${BRAND_NAME_AR}`,
    description: FAQ_PAGE_DESCRIPTION,
    url: '/faq',
  }),
};

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqPageJsonLd()) }}
      />
      <SeoBreadcrumb
        items={[
          { href: PUBLIC_ROUTES.home, label: 'الرئيسية' },
          { label: FAQ_PAGE_TITLE },
        ]}
      />
      <PageHero
        title="الأسئلة الشائعة"
        description="إنشاء الغرفة، دخول الأصحاب، عدد اللاعبين، واختيار اللعبة. قواعد كل لعبة في صفحتها."
        variant="compact"
        className="mb-10"
      />
      <FAQAccordion grouped />
    </main>
  );
}
