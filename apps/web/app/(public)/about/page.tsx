import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/public/page-hero';
import { SeoBreadcrumb } from '@/components/public/seo-breadcrumb';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { PUBLIC_ROUTES } from '@/lib/public/routes';
import {
  ABOUT_PAGE_DESCRIPTION,
  ABOUT_PAGE_TITLE,
  SITE_ORIGIN,
  buildPublicSocialMetadata,
} from '@/lib/public/seo';

export const metadata: Metadata = {
  title: ABOUT_PAGE_TITLE,
  description: ABOUT_PAGE_DESCRIPTION,
  alternates: { canonical: PUBLIC_ROUTES.about },
  ...buildPublicSocialMetadata({
    title: `${ABOUT_PAGE_TITLE} | ${BRAND_NAME_AR}`,
    description: ABOUT_PAGE_DESCRIPTION,
    url: PUBLIC_ROUTES.about,
  }),
};

const sectionClassName =
  'min-w-0 rounded-[var(--wanas-radius-panel)] border border-wanas-border bg-wanas-surface p-5 shadow-[var(--wanas-shadow-panel)] sm:p-7';
const headingClassName = 'text-xl font-extrabold text-wanas-text-primary sm:text-2xl';
const bodyClassName = 'mt-3 space-y-3 text-sm leading-8 text-wanas-text-secondary sm:text-base';

const aboutJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: ABOUT_PAGE_TITLE,
    description: ABOUT_PAGE_DESCRIPTION,
    url: `${SITE_ORIGIN}${PUBLIC_ROUTES.about}`,
    inLanguage: 'ar',
    isPartOf: {
      '@type': 'WebSite',
      name: BRAND_NAME_AR,
      url: `${SITE_ORIGIN}/`,
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'الرئيسية',
        item: `${SITE_ORIGIN}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: ABOUT_PAGE_TITLE,
        item: `${SITE_ORIGIN}${PUBLIC_ROUTES.about}`,
      },
    ],
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />
      <SeoBreadcrumb
        items={[
          { href: PUBLIC_ROUTES.home, label: 'الرئيسية' },
          { label: ABOUT_PAGE_TITLE },
        ]}
      />
      <PageHero
        title="عن وناستنا"
        description="منصة ألعاب جماعية عربية تعمل من المتصفح: غرفة، رمز، وأصحابك معك."
        variant="compact"
        className="mb-8 sm:mb-10"
      />

      <article className="mx-auto min-w-0 max-w-4xl space-y-5 sm:space-y-6">
        <section className={sectionClassName}>
          <h2 className={headingClassName}>وش وناستنا؟</h2>
          <div className={bodyClassName}>
            <p>
              وناستنا منصة ألعاب جماعية عربية تشتغل من المتصفح. الفكرة بسيطة: تنشئ غرفة، تشارك
              الرمز، ويدخل أصحابك ويلعبون معك بدون ما تحمّلون تطبيقًا موحّدًا.
            </p>
            <p>
              اللعب موجّه للقروب: نقاش، رسم، أسئلة، وتوقيت — مو ألعاب منصات أو متاجر تطبيقات.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>كيف تشتغل الغرفة؟</h2>
          <div className={bodyClassName}>
            <p>
              واحد يفتح غرفة من الرئيسية ويكتب اسمه. يطلع له رمز، والباقي يدخلون بنفس الرمز
              من صفحة الانضمام. بعد ما تجتمعون في اللوبي تختارون اللعبة وتبدؤون.
            </p>
            <p>
              الحساب اختياري. تقدر تلعب كضيف بالاسم الظاهر في الغرفة. التفاصيل التشغيلية في{' '}
              <Link href={PUBLIC_ROUTES.faq} className="text-wanas-primary-dark font-bold hover:underline">
                الأسئلة الشائعة
              </Link>
              .
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>الألعاب</h2>
          <div className={bodyClassName}>
            <p>
              حالياً ثمان ألعاب جاهزة، وكل واحدة لها صفحة تشرح التدفق والنقاط والأدوار إن
              وجدت. قارنوا العدد وأسلوب اللعب من صفحة الألعاب قبل ما تبدؤون.
            </p>
            <p>
              <Link href={PUBLIC_ROUTES.games} className="text-wanas-primary-dark font-bold hover:underline">
                تصفح الألعاب واختر لعبة
              </Link>
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
