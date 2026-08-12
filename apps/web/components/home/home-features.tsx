import { cn } from '@/lib/utils';

const features = [
  {
    title: 'بدون تسجيل',
    description: 'ادخل باسمك فقط وابدأ اللعب مباشرة — بدون حسابات ولا خطوات إضافية.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.5" />
        <path d="m4 4 16 16" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: 'لعب سلس',
    description: 'تجربة خفيفة وسريعة في المتصفح على الجوال والكمبيوتر.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 21h8" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: 'حتى 8 لاعب',
    description: 'اجمع أصدقاءك في غرفة واحدة واستمتعوا بألعاب جماعية حماسية.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 19a5 5 0 0 1 10 0" stroke="currentColor" strokeWidth="1.5" />
        <path d="M14 17.5a4 4 0 0 1 6 1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
] as const;

export function HomeFeatures() {
  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {features.map((feature) => (
        <article
          key={feature.title}
          className={cn(
            'rounded-[1.5rem] border border-[#E2E8F0] bg-white p-7 text-center shadow-sm transition-all duration-200',
            'hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:shadow-md',
          )}
        >
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
            {feature.icon}
          </div>
          <h3 className="mt-5 text-lg font-bold text-[#0F172A]">{feature.title}</h3>
          <p className="mt-3 text-sm leading-7 text-[#64748B]">{feature.description}</p>
        </article>
      ))}
    </section>
  );
}
