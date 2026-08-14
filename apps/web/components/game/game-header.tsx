'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useGameExperienceShellActive } from '@/contexts/game-experience-context';
import { GameTimerChip } from '@/components/game/game-timer-chip';
import { cn } from '@/lib/utils';

export type GameHeaderProps = {
  gameName: string;
  gameIcon?: ReactNode;
  roomCode: string;
  currentRound?: number;
  totalRounds?: number;
  phaseLabel?: string;
  timer?: {
    remainingSeconds: number;
    format?: 'mm:ss' | 'seconds';
    lowTimeThreshold?: number;
  };
  trailing?: ReactNode;
  className?: string;
};

export function GameHeader({
  gameName,
  gameIcon,
  roomCode,
  currentRound,
  totalRounds,
  phaseLabel,
  timer,
  trailing,
  className,
}: GameHeaderProps) {
  // No-op under the live Experience Shell. Still rendered by /dev previews.
  const shellActive = useGameExperienceShellActive();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  if (shellActive) {
    return null;
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const showRound =
    typeof currentRound === 'number' &&
    typeof totalRounds === 'number' &&
    totalRounds > 0;

  const roomCodeBlock = (
    <div className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl border border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] px-2 py-0.5 shadow-sm sm:min-h-10 sm:gap-1.5 sm:px-2.5 sm:py-1">
      <span className="font-mono text-[11px] font-semibold tracking-[0.14em] text-wanas-accent sm:text-sm">
        {roomCode}
      </span>
      <button
        type="button"
        onClick={() => void handleCopyCode()}
        className={cn(
          'inline-flex size-8 min-h-8 min-w-8 items-center justify-center rounded-lg text-xs font-bold',
          'text-wanas-accent transition-all duration-200',
          'hover:bg-wanas-accent-soft active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/40 focus-visible:ring-offset-1',
        )}
        aria-label={copied ? 'تم نسخ رمز الغرفة' : 'نسخ رمز الغرفة'}
      >
        {copied ? '✓' : '📋'}
      </button>
    </div>
  );

  const metaChips = (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
      {phaseLabel ? (
        <span className="wanas-game-phase-badge max-w-[9.5rem] truncate sm:max-w-none">{phaseLabel}</span>
      ) : null}
      {showRound ? (
        <span className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-card)] px-2 py-0.5 text-[11px] font-medium text-wanas-text-secondary shadow-sm sm:min-h-10 sm:px-2.5 sm:py-1 sm:text-xs">
          <span aria-hidden>🚩</span>
          {currentRound}/{totalRounds}
        </span>
      ) : null}
      {timer ? (
        <GameTimerChip
          remainingSeconds={timer.remainingSeconds}
          format={timer.format}
          lowTimeThreshold={timer.lowTimeThreshold}
        />
      ) : null}
      {trailing}
    </div>
  );

  const titleBlock = (
    <div className="flex min-w-0 items-center justify-center gap-2 sm:gap-2.5">
      {gameIcon ? (
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-wanas-accent-soft text-sm shadow-sm sm:size-10 sm:text-lg"
          aria-hidden
        >
          {gameIcon}
        </div>
      ) : null}
      <p className="truncate text-sm font-semibold text-wanas-text-primary sm:text-base">{gameName}</p>
    </div>
  );

  return (
    <header
      className={cn(
        'sticky top-0 z-30 rounded-2xl border backdrop-blur-xl',
        'border-[color:var(--wanas-game-header-border)] bg-[color:var(--wanas-game-header-bg)]',
        'shadow-[var(--wanas-game-header-shadow)]',
        'px-2.5 py-1.5 sm:px-4 sm:py-2.5',
        'top-[max(0px,env(safe-area-inset-top,0px))]',
        className,
      )}
    >
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex items-center justify-between gap-2">
          {roomCodeBlock}
          {metaChips}
        </div>
        {titleBlock}
      </div>

      <div className="hidden grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:grid">
        <div className="flex min-w-0 justify-self-start">{roomCodeBlock}</div>
        <div className="min-w-0">{titleBlock}</div>
        <div className="min-w-0 justify-self-end">{metaChips}</div>
      </div>
    </header>
  );
}
