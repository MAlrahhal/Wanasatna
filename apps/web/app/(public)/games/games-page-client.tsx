'use client';

import { useState } from 'react';
import { GameCatalogCard } from '@/components/public/game-cards';
import { PageHero } from '@/components/public/page-hero';
import { SectionHeader } from '@/components/public/section-header';
import { filterCatalogGames, getAllCatalogGames } from '@/lib/public/game-catalog';
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
      <PageHero
        title="الألعاب الجماعية في وناستنا"
        description="ثمان ألعاب جاهزة للعب مع أصحابك من المتصفح. اقرأ فكرة كل لعبة، كم لاعب تناسب، وبعدين أنشئ غرفة أو انضم برمز."
        variant="compact"
        className="mb-10"
      />

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
