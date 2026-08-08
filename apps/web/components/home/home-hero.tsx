import { HomeBrandLogo } from '@/components/home/home-brand-logo';
import { HOME_SECTIONS } from '@/lib/home/sections';
import { cn } from '@/lib/utils';

type HomeHeroProps = {
  onCreateRoomClick: () => void;
  onJoinRoomClick: () => void;
  isSubmitting: boolean;
};

const benefitChips = ['بدون تسجيل', 'حتى 12 لاعب', 'عربي بالكامل'] as const;

export function HomeHero({ onCreateRoomClick, onJoinRoomClick, isSubmitting }: HomeHeroProps) {
  return (
    <section
      id={HOME_SECTIONS.top}
      className="relative scroll-mt-24 overflow-hidden rounded-[2rem] border border-wanas-border bg-wanas-brand-sky px-5 py-12 sm:px-8 sm:py-16 lg:px-10"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -start-8 top-8 text-white/20"
      >
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 9h12v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M8 9V7a4 4 0 1 1 8 0v2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -end-6 bottom-8 text-white/20"
      >
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="9" cy="9" r="1" fill="currentColor" />
          <circle cx="15" cy="15" r="1" fill="currentColor" />
        </svg>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-16 start-8 rotate-12 text-white/15"
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="5" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9 9h6M9 13h4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>

      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <HomeBrandLogo size="md" className="justify-center" />

        <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-wanas-brand-navy sm:text-4xl lg:text-[2.75rem]">
          مكان واحد تلعب فيه مع أصحابك
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-wanas-text-secondary sm:text-base">
          أنشئ غرفة خاصة، شارك الرمز مع أصدقائك، وابدأ اللعب فوراً — بدون تسجيل وبدون
          تعقيد.
        </p>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {benefitChips.map((chip) => (
            <li
              key={chip}
              className="rounded-full border border-white/40 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-wanas-brand-navy"
            >
              {chip}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex w-full max-w-lg flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCreateRoomClick}
            disabled={isSubmitting}
            className={cn(
              'inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-wanas-brand-navy px-5 text-sm font-semibold text-white transition-all duration-200',
              'hover:bg-wanas-brand-navy-hover',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-brand-navy/40 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            <span aria-hidden>+</span>
            إنشاء غرفة
          </button>

          <button
            type="button"
            onClick={onJoinRoomClick}
            disabled={isSubmitting}
            className={cn(
              'inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-wanas-brand-navy bg-white px-5 text-sm font-semibold text-wanas-brand-navy transition-all duration-200',
              'hover:bg-wanas-accent-soft',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-brand-navy/30 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            <span aria-hidden>↪</span>
            الانضمام إلى غرفة
          </button>
        </div>
      </div>
    </section>
  );
}
