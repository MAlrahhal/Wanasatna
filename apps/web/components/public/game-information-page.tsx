import Link from 'next/link';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { getGameSeoPage, type GameSeoPage } from '@/lib/public/game-seo-content';
import { PUBLIC_ROUTES, getGameInformationPath } from '@/lib/public/routes';
import { getHomeRoomActionsHref } from '@/lib/public/scroll-to-room-actions';
import { GameArtwork } from '@/components/game/game-artwork';

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
      <p className="text-wanas-text-muted mb-6 text-sm font-semibold">
        <Link href={PUBLIC_ROUTES.games} className="hover:text-wanas-primary-dark hover:underline">
          كل الألعاب
        </Link>
      </p>

      <header className="border-wanas-border bg-wanas-hero mb-8 rounded-[1.5rem] border px-5 py-8 sm:px-8">
        {entry.imagePath ? (
          <div className="mb-4 size-28 sm:size-32">
            <GameArtwork src={entry.imagePath} sizes="128px" />
          </div>
        ) : (
          <div
            className="mb-4 flex size-14 items-center justify-center rounded-[18px] text-lg font-bold"
            style={{ backgroundColor: entry.iconBg, color: entry.iconText }}
            aria-hidden
          >
            {page.title.slice(0, 1)}
          </div>
        )}
        <h1 className="text-wanas-text-primary text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          {page.title}
        </h1>
        <p className="text-wanas-text-secondary mt-4 text-sm leading-7 sm:text-base">
          {page.intro}
        </p>
      </header>

      <div className="text-wanas-text-secondary space-y-8 text-sm leading-7 sm:text-base">
        <section>
          <h2 className="text-wanas-text-primary mb-2 text-xl font-extrabold">وش فكرة اللعبة؟</h2>
          <p>{page.idea}</p>
        </section>

        <section>
          <h2 className="text-wanas-text-primary mb-3 text-xl font-extrabold">كيف تلعب؟</h2>
          <ol className="list-decimal space-y-2 pr-5">
            {page.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-wanas-text-primary mb-2 text-xl font-extrabold">كم لاعب تحتاج؟</h2>
          <p>{page.playerNeed}</p>
        </section>

        <section>
          <h2 className="text-wanas-text-primary mb-2 text-xl font-extrabold">متى تناسب؟</h2>
          <ul className="list-disc space-y-1 pr-5">
            {page.whenFits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="border-wanas-border bg-wanas-surface rounded-[20px] border p-5">
          <h2 className="text-wanas-text-primary mb-2 text-xl font-extrabold">ابدأ اللعب</h2>
          <p className="mb-4">
            أنشئ غرفة أو انضم برمز من الصفحة الرئيسية، بعدين اختاروا اللعبة من اللوبي.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={getHomeRoomActionsHref()}
              className="bg-wanas-accent hover:bg-wanas-accent-hover inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-bold text-white"
            >
              ابدأ من الرئيسية
            </Link>
            <Link
              href={PUBLIC_ROUTES.games}
              className="border-wanas-border bg-wanas-surface text-wanas-text-primary inline-flex h-11 items-center justify-center rounded-2xl border px-5 text-sm font-bold"
            >
              رجوع للألعاب
            </Link>
          </div>
        </section>

        {related.length > 0 ? (
          <section>
            <h2 className="text-wanas-text-primary mb-3 text-xl font-extrabold">ألعاب قريبة</h2>
            <ul className="flex flex-wrap gap-3">
              {related.map((item) => (
                <li key={item.id}>
                  <Link
                    href={getGameInformationPath(item.id)}
                    className="bg-wanas-primary-surface text-wanas-primary-dark hover:bg-wanas-primary-surface-strong inline-flex rounded-full px-4 py-2 text-sm font-bold"
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
