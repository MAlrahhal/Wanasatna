import Link from 'next/link';
import { PageHero } from '@/components/public/page-hero';
import { PUBLIC_EXTERNAL_LINKS } from '@/lib/public/external-links';
import { PUBLIC_ROUTES } from '@/lib/public/routes';

export function ContactPageClient() {
  return (
    <main
      id="discord-invite-pending"
      className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12"
    >
      <PageHero title="تواصل معنا" variant="compact" className="w-full">
        <div className="text-wanas-text-secondary mx-auto max-w-2xl space-y-6 text-start text-sm leading-8 sm:text-base">
          <p>
            ما فيه نموذج داخل الموقع ولا بريد معلن. القناة الحالية للتواصل هي سيرفر Discord
            الرسمي.
          </p>

          <section>
            <h2 className="text-wanas-text-primary mb-2 text-lg font-extrabold">تقدر تراسل عن</h2>
            <ul className="list-disc space-y-1 pr-5">
              <li>مشكلة أثناء اللعب أو دخول الغرفة</li>
              <li>اقتراح يوضح تجربة الألعاب الحالية</li>
              <li>ملاحظة على صفحة عامة أو شرح لعبة</li>
            </ul>
          </section>

          <section>
            <h2 className="text-wanas-text-primary mb-2 text-lg font-extrabold">
              وش يفيد عند الإبلاغ عن خلل
            </h2>
            <ul className="list-disc space-y-1 pr-5">
              <li>اسم اللعبة إذا صارت داخل مباراة</li>
              <li>وش كنت تسوي قبل المشكلة</li>
              <li>الجهاز والمتصفح إذا قدرت</li>
            </ul>
          </section>

          <p>
            ما نحدد هنا مدة رد ثابتة. التفاصيل التشغيلية للغرف والحساب في{' '}
            <Link href={PUBLIC_ROUTES.faq} className="text-wanas-primary-dark font-bold hover:underline">
              الأسئلة الشائعة
            </Link>
            ، وشرح الألعاب في{' '}
            <Link href={PUBLIC_ROUTES.games} className="text-wanas-primary-dark font-bold hover:underline">
              صفحة الألعاب
            </Link>
            .
          </p>

          <div className="text-center">
            <a
              href={PUBLIC_EXTERNAL_LINKS.discordInvite}
              className="border-wanas-accent bg-wanas-accent hover:border-wanas-accent-hover hover:bg-wanas-accent-hover focus-visible:ring-wanas-accent/45 mt-2 inline-flex min-h-14 w-full max-w-sm items-center justify-center rounded-[var(--wanas-radius-control)] border px-6 text-base font-bold text-white shadow-[0_4px_0_var(--wanas-brand-navy)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_5px_0_var(--wanas-brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-1 active:shadow-none sm:w-auto sm:min-w-72"
            >
              انضم إلى ديسكورد وناستنا
            </a>
          </div>
        </div>
      </PageHero>
    </main>
  );
}
