'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
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

  const showGameplayAds = meta.layoutMode === 'gameplay';
  const resultSideAds =
    meta.layoutMode === 'round-results'
      ? {
          chat: 'round-results-right-desktop',
          leaderboard: 'round-results-left-desktop',
        }
      : meta.layoutMode === 'final-results'
        ? {
            chat: 'final-results-right-desktop',
            leaderboard: 'final-results-left-desktop',
          }
        : null;

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
      <GameExperienceHeader meta={meta} mobilePanelControls={mobileControls} />

      <div className="hidden min-h-0 flex-1 gap-2 lg:grid lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_minmax(220px,260px)]">
        <div className="flex min-h-0 flex-col gap-3">
          <GameChatMockPanel
            className={cn(
              'max-h-[min(560px,calc(100vh-12rem))]',
              (showGameplayAds || resultSideAds) &&
                '2xl:max-h-[min(480px,calc(100vh-22rem))]',
            )}
          />
          {showGameplayAds ? (
            <AdPlaceholder
              placement="game-chat-desktop"
              format="vertical"
              className="hidden h-[clamp(7rem,16vh,12rem)] shrink-0 2xl:flex"
            />
          ) : null}
          {resultSideAds ? (
            <AdPlaceholder
              placement={resultSideAds.chat}
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
              (showGameplayAds || resultSideAds) &&
                '2xl:max-h-[min(480px,calc(100vh-22rem))]',
            )}
          />
          {showGameplayAds ? (
            <AdPlaceholder
              placement="game-leaderboard-desktop"
              format="vertical"
              className="hidden h-[clamp(7rem,16vh,12rem)] shrink-0 2xl:flex"
            />
          ) : null}
          {resultSideAds ? (
            <AdPlaceholder
              placement={resultSideAds.leaderboard}
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
          ref={chatPanelRef}
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
          ref={leaderboardPanelRef}
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
