import Link from 'next/link';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { getGameSeoPage, type GameSeoPage } from '@/lib/public/game-seo-content';
import { PUBLIC_ROUTES, getGameInformationPath } from '@/lib/public/routes';
import { getHomeRoomActionsHref } from '@/lib/public/scroll-to-room-actions';

type GameInformationPageProps = {
  page: GameSeoPage;
};

export function GameInformationPage({ page }: GameInformationPageProps) {
  const entry = getGameCatalogEntry(page.id);
  const related = page.relatedIds
    .map((id) => getGameSeoPage(id))
    .filter((item): item is GameSeoPage => item !== null);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <p className="mb-6 text-sm font-semibold text-wanas-text-muted">
        <Link href={PUBLIC_ROUTES.games} className="hover:text-wanas-primary-dark hover:underline">
          كل الألعاب
        </Link>
      </p>

      <header className="mb-8 border-y border-wanas-border bg-wanas-hero px-5 py-8 sm:px-8">
        <div
          className="mb-4 flex size-14 items-center justify-center rounded-[18px] text-lg font-bold"
          style={{ backgroundColor: entry.iconBg, color: entry.iconText }}
          aria-hidden
        >
          {page.title.slice(0, 1)}
        </div>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-wanas-text-primary sm:text-4xl">
          {page.title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-wanas-text-secondary sm:text-base">{page.intro}</p>
      </header>

      <div className="space-y-8 text-sm leading-7 text-wanas-text-secondary sm:text-base">
        <section>
          <h2 className="mb-2 text-xl font-extrabold text-wanas-text-primary">وش فكرة اللعبة؟</h2>
          <p>{page.idea}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-extrabold text-wanas-text-primary">كيف تلعب؟</h2>
          <ol className="list-decimal space-y-2 pr-5">
            {page.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-extrabold text-wanas-text-primary">كم لاعب تحتاج؟</h2>
          <p>{page.playerNeed}</p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-extrabold text-wanas-text-primary">متى تناسب؟</h2>
          <ul className="list-disc space-y-1 pr-5">
            {page.whenFits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-[20px] border border-wanas-border bg-wanas-surface p-5">
          <h2 className="mb-2 text-xl font-extrabold text-wanas-text-primary">ابدأ اللعب</h2>
          <p className="mb-4">
            أنشئ روم أو انضم برمز من الصفحة الرئيسية، بعدين اختاروا اللعبة من اللوبي.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={getHomeRoomActionsHref()}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-wanas-accent px-5 text-sm font-bold text-white hover:bg-wanas-accent-hover"
            >
              ابدأ من الرئيسية
            </Link>
            <Link
              href={PUBLIC_ROUTES.games}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-wanas-border bg-wanas-surface px-5 text-sm font-bold text-wanas-text-primary"
            >
              رجوع للألعاب
            </Link>
          </div>
        </section>

        {related.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xl font-extrabold text-wanas-text-primary">ألعاب قريبة</h2>
            <ul className="flex flex-wrap gap-3">
              {related.map((item) => (
                <li key={item.id}>
                  <Link
                    href={getGameInformationPath(item.id)}
                    className="inline-flex rounded-full bg-wanas-primary-surface px-4 py-2 text-sm font-bold text-wanas-primary-dark hover:bg-wanas-primary-surface-strong"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
