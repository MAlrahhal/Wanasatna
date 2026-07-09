import type { LobbyGame } from '@/lib/lobby/types';
import { GameCard } from './game-card';

type GameGridProps = {
  games: LobbyGame[];
  selectedGameId: string | null;
  canSelect: boolean;
  onSelectGame: (gameId: string) => void;
};

export function GameGrid({
  games,
  selectedGameId,
  canSelect,
  onSelectGame,
}: GameGridProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">اختيار اللعبة</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {canSelect
            ? 'اختر لعبة لعرض إعداداتها. بدء اللعب غير متاح بعد.'
            : 'يمكن للمضيف فقط اختيار اللعبة.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            selected={selectedGameId === game.id}
            disabled={!canSelect}
            onSelect={onSelectGame}
          />
        ))}
      </div>
    </section>
  );
}
