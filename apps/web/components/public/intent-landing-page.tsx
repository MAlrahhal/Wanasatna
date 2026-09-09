import Link from 'next/link';
import { PublicComparisonTable } from '@/components/public/public-comparison-table';
import { SeoBreadcrumb } from '@/components/public/seo-breadcrumb';
import { getGameSeoPage } from '@/lib/public/game-seo-content';
import {
  getIntentSeoPage,
  type IntentSeoPage,
} from '@/lib/public/intent-seo-content';
import { PUBLIC_ROUTES, getGameInformationPath } from '@/lib/public/routes';
import { getHomeRoomActionsHref } from '@/lib/public/scroll-to-room-actions';

type IntentLandingPageProps = {
  page: IntentSeoPage;
};

export function IntentLandingPage({ page }: IntentLandingPageProps) {
  const relatedIntents = page.relatedIntentIds.map((id) => getIntentSeoPage(id));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <SeoBreadcrumb
        items={[
          { href: PUBLIC_ROUTES.home, label: 'الرئيسية' },
          { href: PUBLIC_ROUTES.games, label: 'الألعاب' },
          { label: page.title },
        ]}
      />

      <header className="border-wanas-border bg-wanas-hero mb-8 rounded-[1.5rem] border px-5 py-8 sm:px-8">
        <h1 className="text-wanas-text-primary text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          {page.title}
        </h1>
        <p className="text-wanas-text-secondary mt-4 text-sm leading-7 sm:text-base">{page.intro}</p>
      </header>

      <div className="text-wanas-text-secondary space-y-8 text-sm leading-7 sm:text-base">
        <section>
          <h2 className="text-wanas-text-primary mb-3 text-xl font-extrabold">متى تناسب؟</h2>
          <ul className="list-disc space-y-1 pr-5">
            {page.useCases.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-wanas-text-primary mb-2 text-xl font-extrabold">{page.chooserTitle}</h2>
          <p className="mb-4">{page.chooserIntro}</p>
          <PublicComparisonTable
            caption={page.chooserTitle}
            columns={page.chooserColumns}
            rows={page.chooserRows.map((row) => {
              const game = getGameSeoPage(row.id);
              return {
                href: getGameInformationPath(row.id),
                cells: [game?.title ?? row.id, row.players, row.note],
              };
            })}
          />
        </section>

        <section>
          <h2 className="text-wanas-text-primary mb-3 text-xl font-extrabold">ألعاب تناسب هالوضع</h2>
          <ul className="space-y-4">
            {page.recommended.map((item) => {
              const game = getGameSeoPage(item.id);
              if (!game) {
                return null;
              }
              return (
                <li key={item.id} className="border-wanas-border bg-wanas-surface rounded-[20px] border p-4">
                  <Link
                    href={getGameInformationPath(item.id)}
                    className="text-wanas-primary-dark text-base font-bold hover:underline"
                  >
                    {game.title}
                  </Link>
                  <p className="mt-2">{item.blurb}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 className="text-wanas-text-primary mb-3 text-xl font-extrabold">أسئلة قصيرة</h2>
          <dl className="space-y-4">
            {page.faqs.map((item) => (
              <div key={item.question}>
                <dt className="text-wanas-text-primary font-bold">{item.question}</dt>
                <dd className="mt-1">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="border-wanas-border bg-wanas-surface rounded-[20px] border p-5">
          <h2 className="text-wanas-text-primary mb-2 text-xl font-extrabold">ابدأ اللعب</h2>
          <p className="mb-4">
            اختاروا اللعبة من اللوبي بعد ما تدخلون الغرفة.{' '}
            <Link href={PUBLIC_ROUTES.faq} className="text-wanas-primary-dark font-bold hover:underline">
              كيف تنشئون غرفة؟
            </Link>
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={getHomeRoomActionsHref()}
              className="bg-wanas-accent hover:bg-wanas-accent-hover inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-bold text-white"
            >
              العب الآن
            </Link>
            <Link
              href={PUBLIC_ROUTES.games}
              className="border-wanas-border bg-wanas-surface text-wanas-text-primary inline-flex h-11 items-center justify-center rounded-2xl border px-5 text-sm font-bold"
            >
              كل الألعاب
            </Link>
          </div>
        </section>

        <section>
          <h2 className="text-wanas-text-primary mb-3 text-xl font-extrabold">صفحات قريبة</h2>
          <ul className="flex flex-wrap gap-3">
            {relatedIntents.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.path}
                  className="bg-wanas-primary-surface text-wanas-primary-dark hover:bg-wanas-primary-surface-strong inline-flex rounded-full px-4 py-2 text-sm font-bold"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
