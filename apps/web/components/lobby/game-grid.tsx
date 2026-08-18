import type { LobbyGame } from '@/lib/lobby/types';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { GameCard } from './game-card';
import { LobbyPanel } from './lobby-ui';

type GameGridProps = {
  games: LobbyGame[];
  selectedGameId: string | null;
  canSelect: boolean;
  onSelectGame: (gameId: string) => void;
  isGameEnabled?: (gameId: string) => boolean;
};

export function GameGrid({
  games,
  selectedGameId,
  canSelect,
  onSelectGame,
  isGameEnabled,
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
      headerClassName="px-3 py-2.5 xl:px-4 xl:py-3"
      bodyClassName="gap-2.5 p-2.5 xl:gap-3 xl:p-3"
    >
      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 xl:grid-cols-3">
        {gridGames.map((game) => {
          const entry = getGameCatalogEntry(game.id);
          const runtimeEnabled = isGameEnabled?.(game.id) ?? true;
          const availability =
            entry.availability === 'coming-soon'
              ? 'coming-soon'
              : runtimeEnabled
                ? 'available'
                : 'unavailable';

          return (
            <GameCard
              key={game.id}
              game={game}
              selected={selectedGameId === game.id}
              disabled={!canSelect || !runtimeEnabled}
              onSelect={onSelectGame}
              availability={availability}
              iconBg={entry.iconBg}
              iconText={entry.iconText}
              playerRange={entry.playerRange}
            />
          );
        })}
      </div>
    </LobbyPanel>
  );
}
