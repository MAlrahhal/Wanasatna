'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { GameTimerChip } from '@/components/game/game-timer-chip';
import { Button } from '@/components/ui/button';
import { UiDialog } from '@/components/ui/dialog';
import { useRoom } from '@/contexts/room-context';
import { normalizeExperiencePhaseLabel } from '@/lib/game/experience-meta';
import type { GameExperienceMeta } from '@/lib/game/shell-types';
import { cn } from '@/lib/utils';
import { GameRoomManagementDialog } from './game-room-management-dialog';

type GameExperienceHeaderProps = {
  meta: GameExperienceMeta;
  mobilePanelControls?: ReactNode;
  className?: string;
};

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M4.9 7.1l1.6 1.6M17.5 15.3l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 16.9l1.6-1.6M17.5 8.7l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GameExperienceHeader({
  meta,
  mobilePanelControls,
  className,
}: GameExperienceHeaderProps) {
  const { isHost, room, leaveRoom } = useRoom();
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const showRound =
    typeof meta.currentRound === 'number' &&
    typeof meta.totalRounds === 'number' &&
    meta.totalRounds > 0;

  const phaseLabel = normalizeExperiencePhaseLabel(meta.phaseLabel);
  const centerLabel = meta.centerLabel?.trim() || undefined;
  const categoryLabel = meta.categoryLabel?.trim() || undefined;
  const primaryCenter = centerLabel ?? categoryLabel;
  const secondaryChip = centerLabel && categoryLabel ? categoryLabel : undefined;

  return (
    <>
      <header
        className={cn(
          'sticky top-[max(0px,env(safe-area-inset-top,0px))] z-30 rounded-[var(--wanas-radius-control)] border px-3 py-2 sm:px-4 sm:py-2.5',
          'border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-structural-bg)]',
          'shadow-[inset_0_-2px_0_var(--wanas-game-accent),var(--wanas-game-shadow)]',
          className,
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5 md:flex-none">
            {meta.gameIcon ? (
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--wanas-game-card)] text-base sm:size-10"
                aria-hidden
              >
                {meta.gameIcon}
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold leading-5 text-[color:var(--wanas-game-text-on-structural)] sm:text-base sm:leading-6">
                {meta.gameName}
              </p>
              {phaseLabel ? (
                <p className="line-clamp-2 text-xs leading-5 text-[color:var(--wanas-game-text-on-structural-muted)] sm:text-sm">
                  {phaseLabel}
                </p>
              ) : null}
            </div>
          </div>

          {primaryCenter ? (
            <p
              className="line-clamp-2 max-w-[min(100%,16rem)] px-2 text-center text-sm font-semibold leading-5 text-white sm:max-w-[min(100%,20rem)] sm:text-base sm:leading-6 md:justify-self-center"
              title={primaryCenter}
            >
              {primaryCenter}
            </p>
          ) : (
            <span className="hidden md:block" />
          )}

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 md:justify-self-end">
            {secondaryChip ? (
              <span
                className="inline-flex max-w-[10rem] items-center rounded-lg border border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] px-2.5 py-1 text-xs font-semibold leading-5 text-[color:var(--wanas-game-text-primary)] sm:max-w-[14rem]"
                title={secondaryChip}
              >
                {secondaryChip}
              </span>
            ) : null}
            {showRound ? (
              <span className="inline-flex min-h-9 items-center rounded-lg border border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] px-2.5 text-xs font-semibold leading-5 text-[color:var(--wanas-game-text-primary)]">
                {meta.currentRound}/{meta.totalRounds}
              </span>
            ) : null}
            {meta.timer ? (
              <GameTimerChip
                remainingSeconds={meta.timer.remainingSeconds}
                format={meta.timer.format}
                lowTimeThreshold={meta.timer.lowTimeThreshold}
              />
            ) : null}
            {isHost && room ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="min-h-9 border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] text-[color:var(--wanas-game-text-primary)]"
                onClick={() => setRoomDialogOpen(true)}
                aria-label="إدارة الغرفة"
              >
                <span className="hidden sm:inline">إدارة الغرفة</span>
                <span className="sm:hidden">
                  <GearIcon />
                </span>
              </Button>
            ) : null}
            {!isHost ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="min-h-9 border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] text-[color:var(--wanas-game-text-primary)]"
                onClick={() => setLeaveDialogOpen(true)}
              >
                مغادرة الغرفة
              </Button>
            ) : null}
            {mobilePanelControls}
          </div>
        </div>
      </header>

      {isHost && room ? (
        <GameRoomManagementDialog
          open={roomDialogOpen}
          onClose={() => setRoomDialogOpen(false)}
          roomCode={room.code}
          gameName={meta.gameName}
        />
      ) : null}

      <UiDialog
        open={leaveDialogOpen}
        title="مغادرة الغرفة؟"
        description="ستخرج من المباراة والغرفة الحالية."
        variant="warning"
        confirmLabel={isLeaving ? 'جاري المغادرة…' : 'مغادرة الغرفة'}
        onClose={() => setLeaveDialogOpen(false)}
        onConfirm={() => {
          setIsLeaving(true);
          void leaveRoom('/').finally(() => {
            setIsLeaving(false);
            setLeaveDialogOpen(false);
          });
        }}
      />
    </>
  );
}
