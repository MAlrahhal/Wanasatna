import type { GameShellPlayer } from '@wanasatna/shared';
import { cn } from '@/lib/utils';

type GameShellPlayersProps = {
  players: GameShellPlayer[];
};

export function GameShellPlayers({ players }: GameShellPlayersProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">اللاعبون</h2>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {players.length}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{player.name}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {player.isHost ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    المضيف
                  </span>
                ) : null}
                {!player.isConnected ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    غير متصل
                  </span>
                ) : null}
              </div>
            </div>
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium',
                player.isReady
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {player.isReady ? 'جاهز' : 'غير جاهز'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
