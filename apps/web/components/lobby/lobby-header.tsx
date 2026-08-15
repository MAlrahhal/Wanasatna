'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { UiDialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { GameAudioControl } from '@/components/game/game-audio-control';
import { canViewRoomInvitationDetails } from '@/lib/room/navigation-guard';
import { buildRoomInviteUrl } from '@/lib/room/session';
import { SYSTEM_COPY, copyLinkFailedMessage } from '@/lib/ui/system-copy';

type LobbyHeaderProps = {
  roomCode: string;
  isLocked: boolean;
  isHost: boolean;
  onLockRoom?: () => void;
  onUnlockRoom?: () => void;
  onLeaveRoom?: () => void;
};

export function LobbyHeader({
  roomCode,
  isLocked,
  isHost,
  onLockRoom,
  onUnlockRoom,
  onLeaveRoom,
}: LobbyHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const leavingRef = useRef(false);
  const showInvitationDetails = canViewRoomInvitationDetails(isHost);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!shareMessage) return;
    const timer = window.setTimeout(() => setShareMessage(null), 2000);
    return () => window.clearTimeout(timer);
  }, [shareMessage]);

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function handleCopyRoomLink() {
    const inviteUrl = buildRoomInviteUrl(roomCode);
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setShareMessage(SYSTEM_COPY.copiedLink);
    } catch {
      setShareMessage(copyLinkFailedMessage(inviteUrl));
    }
  }

  function handleConfirmLeave() {
    if (leavingRef.current) {
      return;
    }
    leavingRef.current = true;
    void Promise.resolve(onLeaveRoom?.()).finally(() => {
      leavingRef.current = false;
      setLeaveOpen(false);
    });
  }

  const mobileActionClassName = 'h-11 min-h-11 w-full xl:h-9 xl:min-h-9 xl:w-auto';

  const leaveControl = (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      className={mobileActionClassName}
      onClick={() => setLeaveOpen(true)}
    >
      مغادرة الغرفة
    </Button>
  );

  const leaveDialog = (
    <UiDialog
      open={leaveOpen}
      title={SYSTEM_COPY.leaveConfirmTitle}
      description={SYSTEM_COPY.leaveConfirmBody}
      variant="warning"
      confirmLabel={SYSTEM_COPY.leave}
      cancelLabel={SYSTEM_COPY.cancel}
      onClose={() => {
        if (!leavingRef.current) {
          setLeaveOpen(false);
        }
      }}
      onConfirm={handleConfirmLeave}
    />
  );

  if (!showInvitationDetails) {
    return (
      <header className="wanas-panel">
        <div className="flex items-center justify-end gap-2 p-2.5 xl:p-4">
          <GameAudioControl />
          {leaveControl}
        </div>
        {leaveDialog}
      </header>
    );
  }

  return (
    <header className="wanas-panel">
      <div className="flex flex-col gap-2.5 p-2.5 xl:flex-row xl:items-center xl:justify-between xl:gap-4 xl:p-4">
        <div className="flex items-center justify-between gap-3 xl:order-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="min-w-0 rounded-xl border border-wanas-border bg-wanas-surface-soft px-2.5 py-1.5 xl:px-3 xl:py-2">
              <p className="text-[11px] font-medium text-wanas-text-muted">رمز الغرفة</p>
              <p dir="ltr" className="mt-0.5 font-mono text-lg font-bold tracking-[0.18em] text-wanas-text-primary xl:text-2xl xl:tracking-[0.2em]">
                {roomCode}
              </p>
            </div>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                isLocked
                  ? 'border-wanas-error-border bg-wanas-error-surface text-wanas-error'
                  : 'border-wanas-success-border bg-wanas-success-surface text-wanas-success-dark',
              )}
            >
              {isLocked ? 'الغرفة مقفلة' : 'الغرفة مفتوحة'}
            </span>
            {isHost ? (
              <span className="rounded-full bg-wanas-warning-surface px-2.5 py-1 text-[11px] font-semibold text-wanas-warning-dark">
                المضيف
              </span>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <GameAudioControl className="xl:hidden" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="size-11 min-h-11 px-0 xl:hidden"
              aria-expanded={menuOpen}
              aria-controls="lobby-header-menu"
              aria-label={menuOpen ? 'إغلاق قائمة الغرفة' : 'فتح قائمة الغرفة'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? '✕' : '☰'}
            </Button>
          </div>
        </div>

        <div
          id="lobby-header-menu"
          className={cn(
            'flex flex-col gap-2 xl:order-1 xl:flex-row xl:flex-wrap xl:items-center',
            menuOpen ? 'flex' : 'hidden xl:flex',
          )}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={mobileActionClassName}
            onClick={() => void handleCopyCode()}
            aria-live="polite"
          >
            {copied ? 'تم النسخ' : 'نسخ الرمز'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={mobileActionClassName}
            onClick={() => void handleCopyRoomLink()}
          >
            {shareMessage === SYSTEM_COPY.copiedLink ? 'تم نسخ الرابط' : 'مشاركة الغرفة'}
          </Button>
          {isLocked ? (
            <Button type="button" variant="outline" size="sm" className={mobileActionClassName} onClick={onUnlockRoom}>
              فتح الغرفة
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" className={mobileActionClassName} onClick={onLockRoom}>
              قفل الغرفة
            </Button>
          )}
          {leaveControl}
          <GameAudioControl className="hidden xl:inline-flex" />
          {shareMessage ? (
            <span className="text-xs font-medium text-wanas-text-muted" aria-live="polite">
              {shareMessage}
            </span>
          ) : null}
        </div>
      </div>
      {leaveDialog}
    </header>
  );
}
