import { HomeSectionHeader } from '@/components/home/home-section-header';
import { HOME_SECTIONS } from '@/lib/home/sections';
import { cn } from '@/lib/utils';

type HomePremiumProps = {
  onExploreClick: () => void;
};

const benefits = [
  'تخصيص الغرفة',
  'حزم ألعاب أو محتوى إضافي',
  'حفظ الإحصائيات والتقدم',
] as const;

export function HomePremium({ onExploreClick }: HomePremiumProps) {
  return (
    <section
      id={HOME_SECTIONS.premium}
      className="scroll-mt-24 rounded-[2rem] border border-wanas-premium-border bg-wanas-surface p-6 sm:p-8"
    >
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-wanas-premium-border bg-wanas-premium-surface px-3 py-1 text-xs font-semibold text-wanas-premium-dark">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6L12 2Z" />
            </svg>
            بريميوم
          </div>
          <HomeSectionHeader
            title="ونساتنا بريميوم"
            description="مزايا إضافية لمن يريد تجربة أوسع، واللعب الأساسي يبقى بدون تسجيل."
          />
          <ul className="mt-6 space-y-3">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3 text-sm text-wanas-text-muted">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-wanas-premium-surface text-wanas-premium-dark">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[1.5rem] border border-wanas-border bg-wanas-surface-soft p-6 text-center shadow-sm">
          <p className="text-sm leading-7 text-wanas-text-muted">
            الحسابات والبريميوم اختيارية — اللعب العادي يبقى مجانياً وبدون تسجيل.
          </p>
          <button
            type="button"
            onClick={onExploreClick}
            className={cn(
              'mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-wanas-premium-border bg-wanas-premium-surface px-5 text-sm font-semibold text-wanas-premium-dark transition-all duration-200',
              'hover:border-wanas-premium hover:bg-wanas-warning-surface-light',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-premium/30 focus-visible:ring-offset-2',
            )}
          >
            استكشف بريميوم
          </button>
        </div>
      </div>
    </section>
  );
}
