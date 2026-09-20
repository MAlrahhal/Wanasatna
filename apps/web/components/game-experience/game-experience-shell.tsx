'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AdPlacement } from '@/components/ads/ad-placement';
import { Button } from '@/components/ui/button';
import { useGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { clearGameAudioEventKeys, stopAllGameSounds } from '@/lib/game/sounds';
import { cn } from '@/lib/utils';
import { useMobileOverlayScrollLock } from '@/lib/ui/use-mobile-overlay-scroll-lock';
import { GameChatMockPanel } from './game-chat-mock-panel';
import { GameExperienceHeader } from './game-experience-header';
import { GameLeaderboardPanel } from './game-leaderboard-panel';
import { GamePlayerRecoveryOverlay } from './game-player-recovery-overlay';

type GameExperienceShellProps = {
  children: ReactNode;
};

function ChatIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 6.5h14v9H9l-4 3v-12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RankingIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 19v-5h3v5H7Zm7 0V9h3v10h-3ZM10.5 7 12 4l1.5 3 3.5.5-2.5 2.4.6 3.4-3.1-1.6-3.1 1.6.6-3.4L7 7.5 10.5 7Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GameExperienceShell({ children }: GameExperienceShellProps) {
  const meta = useGameExperienceMeta();
  const { playerRecovery } = useGameShell();
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const mobilePanelControlsRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const leaderboardPanelRef = useRef<HTMLDivElement>(null);

  useMobileOverlayScrollLock(chatOpen, '(max-width: 1023px)');

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

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }

      const activePanel = chatOpen ? chatPanelRef.current : leaderboardPanelRef.current;
      if (
        activePanel?.contains(event.target) ||
        mobilePanelControlsRef.current?.contains(event.target)
      ) {
        return;
      }

      setChatOpen(false);
      setLeaderboardOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [chatOpen, leaderboardOpen]);

  if (!meta) {
    return <>{children}</>;
  }

  const showGameplayChrome = meta.layoutMode === 'gameplay';

  const mobileControls = (
    <div ref={mobilePanelControlsRef} className="flex shrink-0 items-center gap-0.5 lg:hidden">
      <Button
        type="button"
        size="sm"
        variant={chatOpen ? 'primary' : 'secondary'}
        className="min-h-11 px-2 text-xs max-[359px]:size-11 max-[359px]:min-w-11 max-[359px]:px-0"
        aria-pressed={chatOpen}
        aria-label="الدردشة"
        onClick={() => {
          setChatOpen((open) => !open);
          setLeaderboardOpen(false);
        }}
      >
        <span className="hidden max-[359px]:inline-flex">
          <ChatIcon />
        </span>
        <span className="max-[359px]:sr-only">دردشة</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant={leaderboardOpen ? 'primary' : 'secondary'}
        className="min-h-11 px-2 text-xs max-[359px]:size-11 max-[359px]:min-w-11 max-[359px]:px-0"
        aria-pressed={leaderboardOpen}
        aria-label="الترتيب"
        onClick={() => {
          setLeaderboardOpen((open) => !open);
          setChatOpen(false);
        }}
      >
        <span className="hidden max-[359px]:inline-flex">
          <RankingIcon />
        </span>
        <span className="max-[359px]:sr-only">الترتيب</span>
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <GameExperienceHeader
        meta={meta}
        mobilePanelControls={showGameplayChrome ? mobileControls : undefined}
      />

      <div
        className={cn(
          'min-h-0 flex-1',
          showGameplayChrome &&
            'lg:grid lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_minmax(220px,260px)] lg:gap-2 xl:grid-cols-[300px_minmax(0,1fr)_minmax(220px,260px)]',
        )}
      >
        {showGameplayChrome ? (
          <div className="hidden min-h-0 flex-col gap-3 lg:flex">
            <GameChatMockPanel className={cn('max-h-[min(560px,calc(100vh-12rem))]')} />
            <AdPlacement placement="game-chat-rectangle" className="hidden xl:block" />
          </div>
        ) : null}
        <div className="relative min-w-0" data-game-primary-content>
          {children}
          {playerRecovery ? <GamePlayerRecoveryOverlay recovery={playerRecovery} /> : null}
        </div>
        {showGameplayChrome ? (
          <div
            className="hidden min-w-0 flex-col gap-3 lg:flex"
            data-game-support-sections
            data-game-support-section="leaderboard"
          >
            <GameLeaderboardPanel
              entries={meta.leaderboardEntries}
              className={cn('max-h-[min(560px,calc(100vh-12rem))]')}
            />
            <div
              className="hidden min-w-0 xl:flex xl:justify-center"
              data-game-ad-association="side-rail"
            >
              <AdPlacement placement="gameplay-side-rail" />
            </div>
          </div>
        ) : null}
      </div>

      {showGameplayChrome && chatOpen ? (
        <div
          ref={chatPanelRef}
          className="mobile-room-chat-sheet fixed inset-x-0 bottom-0 z-50 flex h-[45dvh] max-h-[45dvh] flex-col overflow-hidden rounded-t-2xl border-t border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-panel-bg)] p-4 shadow-[var(--wanas-game-shadow)] lg:hidden"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="الدردشة"
          data-testid="mobile-game-chat-sheet"
        >
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <p className="text-sm font-semibold text-[color:var(--wanas-game-text-primary)]">
              الدردشة
            </p>
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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <GameChatMockPanel className="h-full flex-1 border-0 bg-transparent p-0 shadow-none" />
          </div>
        </div>
      ) : null}

      {showGameplayChrome && leaderboardOpen ? (
        <div
          ref={leaderboardPanelRef}
          className="fixed inset-x-0 bottom-0 z-40 max-h-[55dvh] overflow-hidden rounded-t-2xl border-t border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-panel-bg)] p-4 shadow-[var(--wanas-game-shadow)] lg:hidden"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
          role="dialog"
          aria-modal="true"
          aria-label="الترتيب"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[color:var(--wanas-game-text-primary)]">
              الترتيب
            </p>
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
