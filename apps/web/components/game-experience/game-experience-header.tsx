'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { GameTimerChip } from '@/components/game/game-timer-chip';
import { Button } from '@/components/ui/button';
import { UiDialog } from '@/components/ui/dialog';
import { useRoom } from '@/contexts/room-context';
import type { GameExperienceMeta } from '@/lib/game/shell-types';
import { cn } from '@/lib/utils';
import { GameRoomManagementDialog } from './game-room-management-dialog';

type GameExperienceHeaderProps = {
  meta: GameExperienceMeta;
  mobilePanelControls?: ReactNode;
  className?: string;
};

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
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
            {meta.gameIcon ? (
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--wanas-game-card)] text-base sm:size-10"
                aria-hidden
              >
                {meta.gameIcon}
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[color:var(--wanas-game-text-on-structural)] sm:text-base">
                {meta.gameName}
              </p>
              {meta.categoryLabel ? (
                <span
                  className="mt-0.5 inline-flex max-w-full truncate rounded-md border border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--wanas-game-text-primary)] sm:text-[11px]"
                  title={meta.categoryLabel}
                >
                  {meta.categoryLabel}
                </span>
              ) : null}
              {meta.phaseLabel ? (
                <p className="truncate text-[11px] text-[color:var(--wanas-game-text-on-structural-muted)] sm:text-xs">
                  {meta.phaseLabel}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {showRound ? (
              <span className="inline-flex min-h-9 items-center rounded-lg border border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] px-2.5 text-[11px] font-semibold text-[color:var(--wanas-game-text-primary)] sm:text-xs">
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
                <span className="sm:hidden" aria-hidden>
                  ⚙
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
