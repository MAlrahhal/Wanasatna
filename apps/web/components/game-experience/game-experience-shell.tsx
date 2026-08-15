'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { cn } from '@/lib/utils';
import { GameChatMockPanel } from './game-chat-mock-panel';
import { GameExperienceHeader } from './game-experience-header';
import { GameLeaderboardPanel } from './game-leaderboard-panel';
import { GamePlayerRecoveryOverlay } from './game-player-recovery-overlay';

type GameExperienceShellProps = {
  children: ReactNode;
};

export function GameExperienceShell({ children }: GameExperienceShellProps) {
  const meta = useGameExperienceMeta();
  const { playerRecovery } = useGameShell();
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  if (!meta) {
    return <>{children}</>;
  }

  const mobileControls = (
    <Button
      type="button"
      size="sm"
      variant={leaderboardOpen ? 'primary' : 'secondary'}
      className="min-h-11 px-3 text-sm lg:hidden"
      aria-pressed={leaderboardOpen}
      aria-label="الترتيب"
      onClick={() => setLeaderboardOpen((open) => !open)}
    >
      الترتيب
    </Button>
  );

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <GameExperienceHeader meta={meta} mobilePanelControls={mobileControls} />

      <div className="hidden min-h-0 flex-1 gap-2 lg:grid lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_minmax(220px,260px)]">
        <GameChatMockPanel className="max-h-[min(560px,calc(100vh-12rem))]" />
        <main className="relative min-w-0">
          {children}
          {playerRecovery ? <GamePlayerRecoveryOverlay recovery={playerRecovery} /> : null}
        </main>
        <GameLeaderboardPanel
          entries={meta.leaderboardEntries}
          className="max-h-[min(560px,calc(100vh-12rem))]"
        />
      </div>

      <div className="relative min-w-0 flex-1 lg:hidden">
        {children}
        {playerRecovery ? <GamePlayerRecoveryOverlay recovery={playerRecovery} /> : null}
      </div>

      {leaderboardOpen ? (
        <div
          className="fixed inset-x-0 bottom-0 z-40 max-h-[55dvh] overflow-hidden rounded-t-2xl border-t border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-panel-bg)] p-4 shadow-[var(--wanas-game-shadow)] lg:hidden"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
          role="dialog"
          aria-label="الترتيب"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[color:var(--wanas-game-text-primary)]">الترتيب</p>
            <button
              type="button"
              className={cn(
                'inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-lg',
                'text-[color:var(--wanas-game-text-secondary)] hover:bg-[color:var(--wanas-game-card)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wanas-game-accent)]',
              )}
              aria-label="إغلاق"
              onClick={() => setLeaderboardOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="max-h-[calc(55dvh-4.5rem)] overflow-y-auto">
            <GameLeaderboardPanel entries={meta.leaderboardEntries} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
