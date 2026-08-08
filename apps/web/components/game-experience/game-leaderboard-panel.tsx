'use client';

import type { GameLeaderboardEntry } from '@/lib/game/shell-types';
import { cn } from '@/lib/utils';

type GameLeaderboardPanelProps = {
  entries: GameLeaderboardEntry[] | null | undefined;
  className?: string;
};

export function GameLeaderboardPanel({ entries, className }: GameLeaderboardPanelProps) {
  const rows = entries ?? [];

  return (
    <aside
      aria-label="الترتيب"
      className={cn('wanas-game-panel flex min-h-0 flex-col p-3 sm:p-4', className)}
    >
      <h2 className="mb-3 text-xs font-semibold text-[color:var(--wanas-game-text-secondary)]">الترتيب</h2>

      <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {rows.map((entry) => (
          <li
            key={entry.playerId}
            className="flex items-center justify-between gap-2 rounded-lg border border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] px-2.5 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-[color:var(--wanas-game-text-primary)]">
              {entry.name}
            </span>
            <span className="shrink-0 text-sm font-bold tabular-nums text-[color:var(--wanas-game-text-primary)]">
              {entry.score}
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
