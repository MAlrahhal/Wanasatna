import type { LobbyGame } from '@/lib/lobby/types';
import { cn } from '@/lib/utils';

type GameCardProps = {
  game: LobbyGame;
  selected: boolean;
  disabled?: boolean;
  onSelect: (gameId: string) => void;
};

export function GameCard({ game, selected, disabled = false, onSelect }: GameCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(game.id)}
      className={cn(
        'flex h-full flex-col rounded-xl border bg-card p-4 text-right transition-all',
        disabled
          ? 'cursor-not-allowed border-border opacity-70'
          : 'hover:border-primary/40 hover:shadow-sm',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
      )}
    >
      <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-secondary text-base font-bold text-secondary-foreground">
        {game.iconLabel}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{game.title}</h3>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
        {game.description}
      </p>
    </button>
  );
}
