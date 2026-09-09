'use client';

import Link from 'next/link';
import { useState } from 'react';
import { GameCatalogCard } from '@/components/public/game-cards';
import { PageHero } from '@/components/public/page-hero';
import { PublicComparisonTable } from '@/components/public/public-comparison-table';
import { SectionHeader } from '@/components/public/section-header';
import { SeoBreadcrumb } from '@/components/public/seo-breadcrumb';
import { filterCatalogGames, getAllCatalogGames } from '@/lib/public/game-catalog';
import { GAME_SELECTION_GUIDE_ROWS } from '@/lib/public/game-selection-guide';
import { listIntentSeoPages } from '@/lib/public/intent-seo-content';
import { PUBLIC_ROUTES, getGameInformationPath } from '@/lib/public/routes';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'available' | 'coming-soon';

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'available', label: 'متاحة' },
  { id: 'coming-soon', label: 'قريباً' },
];

export function GamesPageClient() {
  const [filter, setFilter] = useState<Filter>('all');
  const games = filterCatalogGames(getAllCatalogGames(), filter);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <SeoBreadcrumb
        items={[
          { href: PUBLIC_ROUTES.home, label: 'الرئيسية' },
          { label: 'الألعاب' },
        ]}
      />

      <PageHero
        title="الألعاب الجماعية في وناستنا"
        description="ثمان ألعاب جاهزة للعب مع أصحابك من المتصفح. قارنوا العدد وأسلوب اللعب، بعدين افتحوا صفحة اللعبة."
        variant="compact"
        className="mb-8"
      />

      <nav aria-label="صفحات حسب طريقة اللعب" className="mb-10 flex flex-wrap gap-2">
        {listIntentSeoPages().map((item) => (
          <Link
            key={item.id}
            href={item.path}
            className="border-wanas-border bg-wanas-surface text-wanas-text-secondary hover:border-wanas-accent hover:text-wanas-text-primary inline-flex rounded-full border px-4 py-2 text-sm font-bold"
          >
            {item.title}
          </Link>
        ))}
        <Link
          href={PUBLIC_ROUTES.home}
          className="border-wanas-border bg-wanas-surface text-wanas-text-secondary hover:border-wanas-accent hover:text-wanas-text-primary inline-flex rounded-full border px-4 py-2 text-sm font-bold"
        >
          أنشئ غرفة
        </Link>
      </nav>

      <section className="mb-10">
        <SectionHeader
          title="أي لعبة نختار؟"
          description="جدول سريع حسب العدد وأسلوب اللعب. التفاصيل في صفحة كل لعبة."
          className="mb-4"
        />
        <PublicComparisonTable
          caption="مقارنة ألعاب وناستنا حسب العدد وأسلوب اللعب"
          columns={['اللعبة', 'اللاعبون', 'الأسلوب', 'ملاحظة']}
          rows={GAME_SELECTION_GUIDE_ROWS.map((row) => ({
            href: getGameInformationPath(row.id),
            cells: [row.title, row.players, row.style, row.note],
          }))}
        />
      </section>

      <div className="mb-8 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-bold transition-colors',
              filter === item.id
                ? 'bg-wanas-accent text-white shadow-sm'
                : 'border border-wanas-border bg-wanas-surface text-wanas-text-secondary hover:bg-wanas-accent-soft',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <SectionHeader
        title={filter === 'all' ? 'جميع الألعاب' : filter === 'available' ? 'الألعاب المتاحة' : 'قريباً'}
        description={`${games.length} ${games.length === 1 ? 'لعبة' : 'ألعاب'}`}
        className="mb-6"
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((game) => (
          <GameCatalogCard key={game.id} game={game} />
        ))}
      </div>
    </main>
  );
}
