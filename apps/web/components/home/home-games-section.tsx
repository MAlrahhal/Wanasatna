import { GameCard } from '@/components/lobby/game-card';
import { HomeSectionHeader } from '@/components/home/home-section-header';
import { getHomeGameShowcase } from '@/lib/home/game-showcase';
import { HOME_SECTIONS } from '@/lib/home/sections';
import type { LobbyGame } from '@/lib/lobby/types';

type HomeGamesSectionProps = {
  games: LobbyGame[];
};

export function HomeGamesSection({ games }: HomeGamesSectionProps) {
  const availableCount = games.filter(
    (game) => getHomeGameShowcase(game.id).availability === 'available',
  ).length;

  return (
    <section id={HOME_SECTIONS.games} className="scroll-mt-24 space-y-8">
      <HomeSectionHeader
        title="الألعاب المتاحة"
        description={`مجموعة ألعاب جماعية عربية — ${availableCount} ألعاب جاهزة للعب الآن والمزيد قريباً.`}
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 11h4v8H6v-8Zm8-4h4v12h-4V7ZM2 6h20v2H2V6Z" fill="currentColor" />
          </svg>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((game) => {
          const showcase = getHomeGameShowcase(game.id);

          return (
            <GameCard
              key={game.id}
              game={game}
              selected={false}
              showcase
              availability={showcase.availability}
              iconClassName={showcase.iconClassName}
              hoverBorderClassName={showcase.hoverBorderClassName}
              onSelect={() => {}}
            />
          );
        })}
      </div>
    </section>
  );
}
