'use client';

import { useState } from 'react';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { ComingSoonNotice } from '@/components/public/coming-soon-notice';
import { FeatureCard } from '@/components/public/feature-card';
import { PageHero } from '@/components/public/page-hero';
import { SectionHeader } from '@/components/public/section-header';
import { cn } from '@/lib/utils';

const benefits = [
  { title: 'تخصيص الغرفة', desc: 'ألوان وثيمات خاصة بغرفتك.', accent: 'blue' as const },
  { title: 'أشكال وثيمات إضافية', desc: 'مظهر أغنى للواجهة.', accent: 'purple' as const },
  { title: 'حزم محتوى وألعاب إضافية', desc: 'محتوى حصري لاحقاً.', accent: 'orange' as const },
  { title: 'حفظ الإحصائيات والتقدم', desc: 'تابع إنجازاتك بين الجلسات.', accent: 'cyan' as const },
  { title: 'مزايا للهوست', desc: 'تحكم أوسع في إدارة الغرفة.', accent: 'green' as const },
  {
    title: 'تجربة خالية من الإعلانات',
    desc: 'إمكانية مستقبلية — ليست ميزة حالية.',
    accent: 'purple' as const,
  },
];

export function PremiumPageClient() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHero variant="premium" title={`${BRAND_NAME_AR} بريميوم`} className="mb-10">
        <p className="mx-auto max-w-2xl text-sm leading-7 text-wanas-text-secondary sm:text-base">
          اللعب الأساسي لا يحتاج إلى حساب وسيبقى متاحاً للجميع. بريميوم تجربة اختيارية بمزايا
          إضافية للراغبين في تجربة أوسع.
        </p>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className={cn(
            'mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-wanas-accent px-6 text-sm font-bold text-white shadow-sm',
            'hover:bg-wanas-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/30 focus-visible:ring-offset-2',
          )}
        >
          بريميوم قريباً
        </button>
      </PageHero>

      <SectionHeader
        title="مزايا مستقبلية"
        description="معاينة لما قد يتضمنه بريميوم — بدون أسعار أو اشتراكات حالياً."
        className="mb-8"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map((b) => (
          <FeatureCard key={b.title} title={b.title} description={b.desc} accent={b.accent} />
        ))}
      </div>

      <ComingSoonNotice
        open={dialogOpen}
        title="بريميوم قريباً"
        description="مزايا بريميوم قيد التطوير. اللعب الأساسي يبقى مجانياً وبدون تسجيل."
        onClose={() => setDialogOpen(false)}
      />
    </main>
  );
}
