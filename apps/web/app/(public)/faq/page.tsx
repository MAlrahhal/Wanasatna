import type { Metadata } from 'next';
import { FAQAccordion } from '@/components/public/faq-accordion';
import { PageHero } from '@/components/public/page-hero';

export const metadata: Metadata = {
  title: 'الأسئلة الشائعة',
};

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHero
        title="الأسئلة الشائعة"
        description="إجابات واضحة عن اللعب، الحساب، بريميوم، والمشاكل التقنية."
        variant="compact"
        className="mb-10"
      />
      <FAQAccordion grouped />
    </main>
  );
}
