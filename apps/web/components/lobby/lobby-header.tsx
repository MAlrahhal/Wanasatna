'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { UiDialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { canViewRoomInvitationDetails } from '@/lib/room/navigation-guard';
import { buildRoomInviteUrl } from '@/lib/room/session';

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
      setShareMessage('تم نسخ الرابط');
    } catch {
      setShareMessage('تعذر نسخ الرابط. انسخه يدوياً من هنا: ' + inviteUrl);
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

  const leaveControl = (
    <Button type="button" variant="destructive" size="sm" onClick={() => setLeaveOpen(true)}>
      مغادرة الغرفة
    </Button>
  );

  const leaveDialog = (
    <UiDialog
      open={leaveOpen}
      title="مغادرة الغرفة؟"
      description="هل أنت متأكد أنك تريد مغادرة الغرفة؟"
      variant="warning"
      confirmLabel="مغادرة الغرفة"
      cancelLabel="إلغاء"
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
        <div className="flex items-center justify-end gap-2 p-3 sm:p-4">{leaveControl}</div>
        {leaveDialog}
      </header>
    );
  }

  return (
    <header className="wanas-panel">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
        <div className="flex items-start justify-between gap-3 sm:order-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="rounded-xl border border-wanas-border bg-wanas-surface-soft px-3 py-2">
              <p className="text-[11px] font-medium text-wanas-text-muted">رمز الغرفة</p>
              <p dir="ltr" className="mt-0.5 font-mono text-xl font-bold tracking-[0.2em] text-wanas-text-primary sm:text-2xl">
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

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="size-9 min-h-9 px-0 sm:hidden"
            aria-expanded={menuOpen}
            aria-controls="lobby-header-menu"
            aria-label={menuOpen ? 'إغلاق قائمة الغرفة' : 'فتح قائمة الغرفة'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? '✕' : '☰'}
          </Button>
        </div>

        <div
          id="lobby-header-menu"
          className={cn(
            'flex flex-col gap-2 sm:order-1 sm:flex-row sm:flex-wrap sm:items-center',
            menuOpen ? 'flex' : 'hidden sm:flex',
          )}
        >
          <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyCode()} aria-live="polite">
            {copied ? 'تم النسخ' : 'نسخ الرمز'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyRoomLink()}>
            {shareMessage === 'تم نسخ الرابط' ? 'تم نسخ الرابط' : 'مشاركة الغرفة'}
          </Button>
          {isLocked ? (
            <Button type="button" variant="outline" size="sm" onClick={onUnlockRoom}>
              فتح الغرفة
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={onLockRoom}>
              قفل الغرفة
            </Button>
          )}
          {leaveControl}
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
