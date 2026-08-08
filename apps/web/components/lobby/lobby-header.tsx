'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { canViewRoomInvitationDetails } from '@/lib/room/navigation-guard';

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

  async function handleShareRoom() {
    const shareUrl = window.location.href;
    const shareData = {
      title: 'Wanasatna',
      text: `انضم إلى غرفتي! الرمز: ${roomCode}`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setShareMessage('تم نسخ رابط الغرفة');
    } catch {
      setShareMessage(null);
    }
  }

  const actionButtonClass =
    'inline-flex h-9 items-center justify-center rounded-full px-4 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-wanas-background sm:h-10 sm:px-5 sm:text-sm';

  const leaveButtonClass = cn(
    actionButtonClass,
    showInvitationDetails
      ? 'border border-wanas-error-border bg-transparent text-wanas-error hover:bg-wanas-error-surface'
      : 'border border-wanas-border bg-wanas-surface-soft text-wanas-text-primary hover:border-wanas-border-strong hover:bg-wanas-surface-muted',
  );

  if (!showInvitationDetails) {
    return (
      <header className="wanas-panel border-b-2 border-b-wanas-accent">
        <div className="flex justify-end p-4 sm:p-5">
          <button type="button" onClick={onLeaveRoom} className={leaveButtonClass}>
            مغادرة الغرفة
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="wanas-panel border-b-2 border-b-wanas-accent">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 sm:order-2">
          <div className="min-w-0 text-right">
            <p className="text-xs font-medium text-wanas-text-muted">غرفة اللعب</p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-2xl font-bold tracking-[0.2em] text-wanas-text-primary sm:text-[1.75rem]">
                {roomCode}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                  isLocked
                    ? 'bg-wanas-error-surface text-wanas-error'
                    : 'bg-wanas-success-surface text-wanas-success-dark',
                )}
              >
                <span className="size-1.5 rounded-full bg-current" aria-hidden />
                {isLocked ? 'مقفلة' : 'مفتوحة'}
              </span>
            </div>
          </div>

          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="lobby-header-menu"
            aria-label={menuOpen ? 'إغلاق قائمة الغرفة' : 'فتح قائمة الغرفة'}
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex size-9 items-center justify-center rounded-xl border border-wanas-border bg-wanas-surface-soft text-wanas-text-primary sm:hidden"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        <div
          id="lobby-header-menu"
          className={cn(
            'flex flex-col gap-2 sm:order-1 sm:flex-row sm:flex-wrap sm:items-center',
            menuOpen ? 'flex' : 'hidden sm:flex',
          )}
        >
          <button
            type="button"
            onClick={handleCopyCode}
            className={cn(actionButtonClass, 'border border-wanas-border bg-wanas-surface-soft text-wanas-text-primary hover:border-wanas-border-strong hover:bg-wanas-surface-muted')}
          >
            {copied ? 'تم النسخ ✓' : 'نسخ الرمز'}
          </button>
          <button
            type="button"
            onClick={handleShareRoom}
            className={cn(actionButtonClass, 'bg-wanas-accent text-[color:var(--wanas-background)] hover:bg-wanas-accent-hover')}
          >
            مشاركة الغرفة
          </button>
          {isLocked ? (
            <button
              type="button"
              onClick={onUnlockRoom}
              className={cn(actionButtonClass, 'border border-wanas-border bg-wanas-surface text-wanas-text-primary hover:bg-wanas-surface-soft')}
            >
              فتح الغرفة
            </button>
          ) : (
            <button
              type="button"
              onClick={onLockRoom}
              className={cn(actionButtonClass, 'border border-wanas-warning-border bg-wanas-warning-surface-light text-wanas-warning-dark hover:bg-wanas-warning-surface')}
            >
              قفل الغرفة
            </button>
          )}
          <button type="button" onClick={onLeaveRoom} className={leaveButtonClass}>
            مغادرة الغرفة
          </button>
          {shareMessage ? (
            <span className="text-xs font-medium text-wanas-text-muted">{shareMessage}</span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
