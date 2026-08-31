'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AdPlaceholder } from '@/components/ads/ad-placeholder';
import { Button } from '@/components/ui/button';
import { useGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { clearGameAudioEventKeys, stopAllGameSounds } from '@/lib/game/sounds';
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
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    return () => {
      stopAllGameSounds();
      clearGameAudioEventKeys();
    };
  }, []);

  useEffect(() => {
    if (!chatOpen && !leaderboardOpen) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setChatOpen(false);
        setLeaderboardOpen(false);
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [chatOpen, leaderboardOpen]);

  if (!meta) {
    return <>{children}</>;
  }

  const showGameplayAds = meta.layoutMode === 'gameplay';

  const mobileControls = (
    <div className="flex items-center gap-1 lg:hidden">
      <Button
        type="button"
        size="sm"
        variant={chatOpen ? 'primary' : 'secondary'}
        className="min-h-11 px-3 text-sm"
        aria-pressed={chatOpen}
        aria-label="الدردشة"
        onClick={() => {
          setChatOpen((open) => !open);
          setLeaderboardOpen(false);
        }}
      >
        دردشة
      </Button>
      <Button
        type="button"
        size="sm"
        variant={leaderboardOpen ? 'primary' : 'secondary'}
        className="min-h-11 px-3 text-sm"
        aria-pressed={leaderboardOpen}
        aria-label="الترتيب"
        onClick={() => {
          setLeaderboardOpen((open) => !open);
          setChatOpen(false);
        }}
      >
        الترتيب
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <GameExperienceHeader meta={meta} mobilePanelControls={mobileControls} />

      <div className="hidden min-h-0 flex-1 gap-2 lg:grid lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_minmax(220px,260px)]">
        <div className="flex min-h-0 flex-col gap-3">
          <GameChatMockPanel
            className={cn(
              'max-h-[min(560px,calc(100vh-12rem))]',
              showGameplayAds && '2xl:max-h-[min(480px,calc(100vh-22rem))]',
            )}
          />
          {showGameplayAds ? (
            <AdPlaceholder
              placement="game-chat-desktop"
              format="vertical"
              className="hidden h-[clamp(7rem,16vh,12rem)] shrink-0 2xl:flex"
            />
          ) : null}
        </div>
        <div className="relative min-w-0">
          {children}
          {playerRecovery ? <GamePlayerRecoveryOverlay recovery={playerRecovery} /> : null}
        </div>
        <div className="flex min-h-0 flex-col gap-3">
          <GameLeaderboardPanel
            entries={meta.leaderboardEntries}
            className={cn(
              'max-h-[min(560px,calc(100vh-12rem))]',
              showGameplayAds && '2xl:max-h-[min(480px,calc(100vh-22rem))]',
            )}
          />
          {showGameplayAds ? (
            <AdPlaceholder
              placement="game-leaderboard-desktop"
              format="vertical"
              className="hidden h-[clamp(7rem,16vh,12rem)] shrink-0 2xl:flex"
            />
          ) : null}
        </div>
      </div>

      <div className="relative min-w-0 flex-1 lg:hidden">
        {children}
        {playerRecovery ? <GamePlayerRecoveryOverlay recovery={playerRecovery} /> : null}
      </div>

      {chatOpen ? (
        <div
          className="fixed inset-x-0 bottom-0 z-40 max-h-[45dvh] overflow-hidden rounded-t-2xl border-t border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-panel-bg)] p-4 shadow-[var(--wanas-game-shadow)] lg:hidden"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
          role="dialog"
          aria-modal="true"
          aria-label="الدردشة"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[color:var(--wanas-game-text-primary)]">الدردشة</p>
            <button
              type="button"
              className={cn(
                'inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-lg',
                'text-[color:var(--wanas-game-text-secondary)] hover:bg-[color:var(--wanas-game-card)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wanas-game-accent)]',
              )}
              aria-label="إغلاق"
              onClick={() => setChatOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="flex max-h-[calc(45dvh-4.5rem)] min-h-[12rem] flex-col overflow-hidden">
            <GameChatMockPanel className="border-0 bg-transparent p-0 shadow-none" />
          </div>
        </div>
      ) : null}

      {leaderboardOpen ? (
        <div
          className="fixed inset-x-0 bottom-0 z-40 max-h-[55dvh] overflow-hidden rounded-t-2xl border-t border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-panel-bg)] p-4 shadow-[var(--wanas-game-shadow)] lg:hidden"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
          role="dialog"
          aria-modal="true"
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
