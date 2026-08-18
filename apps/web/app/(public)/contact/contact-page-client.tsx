'use client';

import { InlineComingSoonBanner } from '@/components/public/coming-soon-notice';
import { FeatureCard } from '@/components/public/feature-card';
import { PageHero } from '@/components/public/page-hero';

const reasons = [
  { title: 'مشكلة تقنية', accent: 'blue' as const },
  { title: 'اقتراح لعبة', accent: 'purple' as const },
  { title: 'تعاون أو شراكة', accent: 'orange' as const },
  { title: 'ملاحظات عامة', accent: 'cyan' as const },
];

export function ContactPageClient() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHero
        title="تواصل معنا"
        description="نرحب بأسئلتك واقتراحاتك. استقبال الرسائل الآلي غير مفعّل بعد."
        variant="compact"
        className="mb-10"
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {reasons.map((item) => (
          <FeatureCard key={item.title} title={item.title} accent={item.accent} />
        ))}
      </div>

      <InlineComingSoonBanner message="الخدمة ستتوفر قريباً — ما نقدر نستلم رسائل من النموذج حالياً." />
    </main>
  );
}
