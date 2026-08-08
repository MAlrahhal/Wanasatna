import { HomeSectionHeader } from '@/components/home/home-section-header';
import { HOME_SECTIONS } from '@/lib/home/sections';
import { cn } from '@/lib/utils';

export function HomeContact() {
  return (
    <section id={HOME_SECTIONS.contact} className="scroll-mt-24">
      <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-[#E2E8F0] bg-white p-6 text-center shadow-sm sm:p-8">
        <HomeSectionHeader
          title="تواصل معنا"
          description="لديك سؤال أو اقتراح؟ فريق ونساتنا سيكون متاحاً قريباً لاستقبال رسائلك."
          align="center"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="m3 7 9 6 9-6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          }
          className="mb-6"
        />

        <button
          type="button"
          disabled
          aria-disabled="true"
          className={cn(
            'inline-flex h-11 items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-5 text-sm font-semibold text-[#94A3B8]',
            'cursor-not-allowed',
          )}
        >
          التواصل متاح قريباً
        </button>
      </div>
    </section>
  );
}
