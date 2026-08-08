'use client';

import { useId, useState } from 'react';
import { HomeSectionHeader } from '@/components/home/home-section-header';
import { HOME_SECTIONS } from '@/lib/home/sections';
import { cn } from '@/lib/utils';

const faqItems = [
  {
    question: 'هل أحتاج إلى حساب للعب؟',
    answer:
      'لا. يمكنك اللعب مباشرة بإدخال اسمك فقط. الحساب اختياري ويُستخدم لاحقاً للمشتريات ومزايا بريميوم وحفظ التقدم.',
  },
  {
    question: 'كم عدد اللاعبين المدعوم؟',
    answer: 'تدعم ونساتنا حتى 12 لاعباً في الغرفة الواحدة.',
  },
  {
    question: 'هل تعمل ونساتنا على الجوال؟',
    answer: 'نعم. المنصة مصممة للعمل في المتصفح على الجوال والكمبيوتر.',
  },
  {
    question: 'كيف أنضم إلى غرفة؟',
    answer: 'أدخل اسمك ورمز الغرفة المكوّن من 6 أرقام الذي شاركه معك صاحب الغرفة.',
  },
  {
    question: 'هل الألعاب مجانية؟',
    answer: 'نعم. اللعب الأساسي مجاني ولا يتطلب تسجيلاً. بريميوم سيوفر لاحقاً مزايا إضافية اختيارية.',
  },
  {
    question: 'ما فائدة تسجيل الدخول؟',
    answer:
      'تسجيل الدخول اختياري وغير مطلوب للعب العادي. عند تفعيله لاحقاً، سيساعد في المشتريات ومزايا بريميوم وحفظ الإحصائيات والتقدم.',
  },
] as const;

export function HomeFaq() {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id={HOME_SECTIONS.faq} className="scroll-mt-24">
      <HomeSectionHeader
        title="الأسئلة الشائعة"
        description="إجابات سريعة عن أهم الأسئلة قبل أن تبدأ اللعب."
        align="center"
        className="mb-8"
      />

      <div className="mx-auto w-full max-w-3xl space-y-3">
        {faqItems.map((item, index) => {
          const isOpen = openIndex === index;
          const buttonId = `${baseId}-faq-button-${index}`;
          const panelId = `${baseId}-faq-panel-${index}`;

          return (
            <article
              key={item.question}
              className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm"
            >
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className={cn(
                    'flex w-full items-center justify-between gap-4 px-5 py-4 text-start text-sm font-semibold text-[#0F172A] sm:text-base',
                    'transition-colors hover:bg-[#F8FAFC]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3B82F6]/30',
                  )}
                >
                  {item.question}
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB] transition-transform duration-200',
                      isOpen && 'rotate-180',
                    )}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </span>
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className="border-t border-[#E2E8F0] px-5 py-4 text-sm leading-7 text-[#64748B]"
              >
                {item.answer}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
