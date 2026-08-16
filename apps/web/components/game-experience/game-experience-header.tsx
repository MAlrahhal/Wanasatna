'use client';

import type { ReactElement, ReactNode } from 'react';
import { cloneElement, isValidElement, useState } from 'react';
import { GameAudioControl } from '@/components/game/game-audio-control';
import { DeadlineTimerChip } from '@/components/game/game-timer-chip';
import { Button } from '@/components/ui/button';
import { UiDialog } from '@/components/ui/dialog';
import { useRoom } from '@/contexts/room-context';
import { normalizeExperiencePhaseLabel } from '@/lib/game/experience-meta';
import type { GameExperienceMeta } from '@/lib/game/shell-types';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';
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

  const phaseLabelRaw = normalizeExperiencePhaseLabel(meta.phaseLabel);
  const phaseLabel =
    phaseLabelRaw && phaseLabelRaw !== meta.gameName ? phaseLabelRaw : undefined;
  const centerLabel = meta.centerLabel?.trim() || undefined;
  const categoryLabel = meta.categoryLabel?.trim() || undefined;
  const primaryCenter = centerLabel ?? categoryLabel;
  const secondaryChip = centerLabel && categoryLabel ? categoryLabel : undefined;

  function renderRoomAction(compact: boolean) {
    if (!(isHost && room)) {
      return null;
    }
    return (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className={cn(
          'border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] text-[color:var(--wanas-game-text-primary)]',
          compact ? 'size-11 min-h-11 px-0' : 'min-h-9',
        )}
        onClick={() => setRoomDialogOpen(true)}
        aria-label="إدارة الغرفة"
      >
        {compact ? <GearIcon /> : 'إدارة الغرفة'}
      </Button>
    );
  }

  function renderLeaveAction() {
    if (isHost) {
      return null;
    }
    return (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="min-h-11 border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] px-2.5 text-xs text-[color:var(--wanas-game-text-primary)] md:min-h-9"
        onClick={() => setLeaveDialogOpen(true)}
      >
        مغادرة الغرفة
      </Button>
    );
  }

  function renderRoundChip() {
    if (!showRound) {
      return null;
    }
    return (
      <span
        dir="ltr"
        className="inline-flex min-h-9 items-center rounded-lg border border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] px-2.5 text-xs font-semibold leading-5 text-[color:var(--wanas-game-text-primary)]"
      >
        {meta.currentRound}/{meta.totalRounds}
      </span>
    );
  }

  function renderTimerChip() {
    if (!meta.timer) {
      return null;
    }
    return (
      <DeadlineTimerChip
        deadlineAtMs={meta.timer.deadlineAtMs}
        format={meta.timer.format}
        lowTimeThreshold={meta.timer.lowTimeThreshold}
      />
    );
  }

  const panelControls = isValidElement(mobilePanelControls)
    ? (mobilePanelControls as ReactElement)
    : null;

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
        <div className="flex flex-col gap-1.5 md:hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {meta.gameIcon ? (
                <div
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--wanas-game-card)] text-sm"
                  aria-hidden
                >
                  {meta.gameIcon}
                </div>
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-5 text-[color:var(--wanas-game-text-on-structural)]">
                  {meta.gameName}
                </p>
                {phaseLabel ? (
                  <p className="truncate text-xs leading-4 text-[color:var(--wanas-game-text-on-structural-muted)]">
                    {phaseLabel}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <GameAudioControl />
              {renderRoomAction(true)}
              {renderLeaveAction()}
              {panelControls}
            </div>
          </div>
          {showRound || meta.timer || primaryCenter ? (
            <div className="flex min-w-0 items-center gap-1.5">
              {renderRoundChip()}
              {renderTimerChip()}
              {primaryCenter ? (
                <span
                  className="min-w-0 truncate rounded-lg border border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] px-2 py-1 text-xs font-semibold leading-4 text-[color:var(--wanas-game-text-primary)]"
                  title={primaryCenter}
                >
                  {primaryCenter}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {meta.gameIcon ? (
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[color:var(--wanas-game-card)] text-base"
                aria-hidden
              >
                {meta.gameIcon}
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="line-clamp-2 text-base font-semibold leading-6 text-[color:var(--wanas-game-text-on-structural)]">
                {meta.gameName}
              </p>
              {phaseLabel ? (
                <p className="line-clamp-2 text-sm leading-5 text-[color:var(--wanas-game-text-on-structural-muted)]">
                  {phaseLabel}
                </p>
              ) : null}
            </div>
          </div>

          {primaryCenter ? (
            <p
              className="line-clamp-2 max-w-[min(100%,20rem)] px-2 text-center text-base font-semibold leading-6 text-white md:justify-self-center"
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
                className="inline-flex max-w-[14rem] items-center rounded-lg border border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] px-2.5 py-1 text-xs font-semibold leading-5 text-[color:var(--wanas-game-text-primary)]"
                title={secondaryChip}
              >
                {secondaryChip}
              </span>
            ) : null}
            {renderRoundChip()}
            {renderTimerChip()}
            <GameAudioControl />
            {renderRoomAction(false)}
            {renderLeaveAction()}
            {panelControls ? cloneElement(panelControls) : null}
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
        title={SYSTEM_COPY.leaveConfirmTitle}
        description={SYSTEM_COPY.leaveConfirmBody}
        variant="warning"
        cancelLabel={SYSTEM_COPY.cancel}
        confirmLabel={isLeaving ? SYSTEM_COPY.leaving : SYSTEM_COPY.leave}
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
