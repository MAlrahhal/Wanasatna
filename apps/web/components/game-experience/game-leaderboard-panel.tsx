'use client';

import type { GameLeaderboardEntry } from '@/lib/game/shell-types';
import { competitionDisplayRanks } from '@/lib/game/leaderboard-sort';
import { cn } from '@/lib/utils';

type GameLeaderboardPanelProps = {
  entries: GameLeaderboardEntry[] | null | undefined;
  className?: string;
};

export function GameLeaderboardPanel({ entries, className }: GameLeaderboardPanelProps) {
  const rows = entries ?? [];
  const displayRanks = competitionDisplayRanks(rows.map((entry) => entry.score));

  return (
    <aside
      aria-label="الترتيب"
      className={cn(
        'wanas-game-panel flex min-h-0 flex-col p-3 sm:p-4',
        className,
      )}
    >
      <h2 className="mb-3 text-xs font-semibold leading-5 text-[color:var(--wanas-game-text-secondary)]">
        الترتيب
      </h2>

      {rows.length === 0 ? (
        <p className="text-xs leading-5 text-[color:var(--wanas-game-text-secondary)]">لا يوجد لاعبون بعد.</p>
      ) : (
        <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {rows.map((entry, index) => {
            const displayRank = displayRanks[index];
            return (
              <li
                key={entry.playerId}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2',
                  entry.isCurrentPlayer
                    ? 'border-wanas-accent/40 bg-wanas-accent/10'
                    : 'border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)]',
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {displayRank != null ? (
                    <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums leading-5 text-[color:var(--wanas-game-text-secondary)]">
                      {displayRank}
                    </span>
                  ) : null}
                  <span className="min-w-0 break-words text-sm font-medium leading-5 text-[color:var(--wanas-game-text-primary)]">
                    {entry.name}
                  </span>
                  {entry.isCurrentPlayer ? (
                    <span className="shrink-0 rounded-full bg-wanas-accent/20 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-wanas-accent">
                      أنت
                    </span>
                  ) : null}
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums leading-5 text-[color:var(--wanas-game-text-primary)]">
                  {entry.score}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
