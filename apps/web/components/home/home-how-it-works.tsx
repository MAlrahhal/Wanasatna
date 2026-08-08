import { HomeSectionHeader } from '@/components/home/home-section-header';
import { HOME_SECTIONS } from '@/lib/home/sections';
import { cn } from '@/lib/utils';

const steps = [
  {
    number: '1',
    title: 'أنشئ غرفة',
    description: 'اختر اسمك وأنشئ غرفة خاصة خلال ثوانٍ.',
  },
  {
    number: '2',
    title: 'شارك رمز الغرفة',
    description: 'أرسل الرمز المكوّن من 6 أرقام لأصدقائك.',
  },
  {
    number: '3',
    title: 'اختاروا اللعبة وابدؤوا',
    description: 'اختر اللعبة من اللobby وابدأوا الوناسة فوراً.',
  },
] as const;

export function HomeHowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24">
      <HomeSectionHeader
        title="ابدأ الوناسة بثلاث خطوات"
        description="من إنشاء الغرفة إلى بدء اللعب — تجربة بسيطة وسريعة للجميع."
        align="center"
        className="mb-10"
      />

      <ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.number} className="relative">
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className="pointer-events-none absolute start-1/2 top-8 hidden h-px w-full bg-[#DBEAFE] md:block"
              />
            ) : null}
            <article
              className={cn(
                'relative h-full rounded-[1.5rem] border border-[#E2E8F0] bg-white p-6 text-center shadow-sm transition-all duration-200',
                'hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:shadow-md',
              )}
            >
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#3B82F6] text-lg font-bold text-white">
                {step.number}
              </div>
              <h3 className="mt-4 text-lg font-bold text-[#0F172A]">{step.title}</h3>
              <p className="mt-2 text-sm leading-7 text-[#64748B]">{step.description}</p>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
