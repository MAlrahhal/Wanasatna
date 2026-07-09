import type { LobbyPlayer } from '@/lib/lobby/types';
import { cn } from '@/lib/utils';

type PlayerCardProps = {
  player: LobbyPlayer;
  canKick?: boolean;
  onKick?: (playerId: string) => void;
};

export function PlayerCard({ player, canKick = false, onKick }: PlayerCardProps) {
  const initial = player.name.charAt(0);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          player.isHost
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground',
        )}
        aria-hidden
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{player.name}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {player.isHost ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              المضيف
            </span>
          ) : null}
          {player.isSpectator ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              متفرّج
            </span>
          ) : null}
        </div>
      </div>

      {canKick && !player.isHost ? (
        <button
          type="button"
          onClick={() => onKick?.(player.id)}
          className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          طرد
        </button>
      ) : null}
    </div>
  );
}
