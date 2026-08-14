import type { LobbyGame } from '@/lib/lobby/types';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { GameCard } from './game-card';
import { LobbyMarathonBanner } from './lobby-marathon-banner';
import { RoundCategoryPanel } from './round-category-panel';
import { LobbyPanel } from './lobby-ui';

type GameGridProps = {
  games: LobbyGame[];
  selectedGameId: string | null;
  selectedRoundCategoryId: string | null;
  canSelect: boolean;
  isActiveMatch: boolean;
  onSelectGame: (gameId: string) => void;
  onSelectRoundCategory: (categoryId: string) => void;
};

export function GameGrid({
  games,
  selectedGameId,
  selectedRoundCategoryId,
  canSelect,
  isActiveMatch,
  onSelectGame,
  onSelectRoundCategory,
}: GameGridProps) {
  const gridGames = games.filter((game) => game.id !== 'marathon');

  return (
    <LobbyPanel
      title="اختيار اللعبة"
      description={
        canSelect
          ? 'اختر لعبة لعرض إعداداتها وبدء الوناسة.'
          : 'اختيار اللعبة متاح للمضيف فقط. بانتظار المضيف.'
      }
      bodyClassName="gap-4 p-4"
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {gridGames.map((game) => {
          const entry = getGameCatalogEntry(game.id);

          return (
            <GameCard
              key={game.id}
              game={game}
              selected={selectedGameId === game.id}
              disabled={!canSelect}
              onSelect={onSelectGame}
              availability={entry.availability}
              iconBg={entry.iconBg}
              iconText={entry.iconText}
              playerRange={entry.playerRange}
            />
          );
        })}
      </div>

      <RoundCategoryPanel
        gameId={selectedGameId}
        selectedCategoryId={selectedRoundCategoryId}
        isHost={canSelect}
        isActiveMatch={isActiveMatch}
        onSelectCategory={onSelectRoundCategory}
      />

      <LobbyMarathonBanner />
    </LobbyPanel>
  );
}
