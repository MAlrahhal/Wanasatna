'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { UiDialog } from '@/components/ui/dialog';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { buildRoomInviteUrl } from '@/lib/room/session';
import { SYSTEM_COPY, copyLinkFailedMessage } from '@/lib/ui/system-copy';
import { cn } from '@/lib/utils';

type GameRoomManagementDialogProps = {
  open: boolean;
  onClose: () => void;
  roomCode: string;
  gameName: string;
};

type ConfirmAction = 'end-game' | 'leave-room' | null;

export function GameRoomManagementDialog({
  open,
  onClose,
  roomCode,
  gameName,
}: GameRoomManagementDialogProps) {
  const { endGame } = useGameShell();
  const { leaveRoom } = useRoom();
  const [copiedCode, setCopiedCode] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!copiedCode) return;
    const id = window.setTimeout(() => setCopiedCode(false), 2000);
    return () => window.clearTimeout(id);
  }, [copiedCode]);

  useEffect(() => {
    if (!shareMessage) return;
    const id = window.setTimeout(() => setShareMessage(null), 2500);
    return () => window.clearTimeout(id);
  }, [shareMessage]);

  if (!open) {
    return null;
  }

  const inviteUrl = buildRoomInviteUrl(roomCode);

  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function handleCopyRoomLink() {
    const copied = await copyText(inviteUrl);
    setShareMessage(copied ? SYSTEM_COPY.copiedLink : copyLinkFailedMessage(inviteUrl));
  }

  async function handleConfirm() {
    if (!confirmAction) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (confirmAction === 'end-game') {
        await endGame();
        onClose();
        return;
      }

      await leaveRoom('/');
    } finally {
      setIsSubmitting(false);
      setConfirmAction(null);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
        role="presentation"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-wanas-text-primary/50" aria-hidden />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-room-management-title"
          dir="rtl"
          className={cn(
            'relative z-10 w-full max-w-md rounded-[var(--wanas-radius-panel)] border border-wanas-border bg-wanas-surface p-5 shadow-[var(--wanas-shadow-panel)] sm:p-6',
            'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2
                id="game-room-management-title"
                className="text-xl font-bold leading-7 text-wanas-text-primary"
              >
                إدارة الغرفة
              </h2>
              <p className="mt-1 text-sm leading-7 text-wanas-text-secondary">{gameName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-9 min-h-9 min-w-9 items-center justify-center rounded-lg text-wanas-text-muted hover:bg-wanas-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/45"
              aria-label="إغلاق"
            >
              ✕
            </button>
          </div>

          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-medium text-wanas-text-muted">رمز الغرفة</dt>
              <dd className="mt-1 flex items-center gap-2">
                <span dir="ltr" className="font-mono text-lg font-bold tracking-widest text-wanas-text-primary">
                  {roomCode}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="min-h-9"
                  onClick={() => {
                    void copyText(roomCode).then((copied) => {
                      if (copied) setCopiedCode(true);
                    });
                  }}
                >
                  {copiedCode ? 'تم النسخ' : 'نسخ الرمز'}
                </Button>
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-wanas-text-muted">رابط الدعوة</dt>
              <dd className="mt-1 min-w-0 truncate rounded-lg border border-wanas-border bg-wanas-surface-soft px-3 py-2 text-xs text-wanas-text-muted" dir="ltr">
                {inviteUrl}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-col gap-2">
            <Button type="button" className="min-h-11 w-full" onClick={() => void handleCopyRoomLink()}>
              {shareMessage === SYSTEM_COPY.copiedLink ? 'تم نسخ الرابط' : 'مشاركة الغرفة'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full"
              onClick={() => setConfirmAction('end-game')}
            >
              إنهاء اللعبة
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 w-full"
              onClick={() => setConfirmAction('leave-room')}
            >
              {SYSTEM_COPY.leave}
            </Button>
            <Button type="button" variant="outline" className="min-h-11 w-full" onClick={onClose}>
              إغلاق
            </Button>
          </div>

          {shareMessage ? (
            <p className="mt-3 text-center text-xs text-wanas-text-muted" role="status">
              {shareMessage}
            </p>
          ) : null}
        </div>
      </div>

      <UiDialog
        open={confirmAction === 'end-game'}
        title="إنهاء اللعبة؟"
        description="سيتم إنهاء المباراة الحالية والعودة إلى اختيار الألعاب لجميع اللاعبين."
        variant="warning"
        cancelLabel={SYSTEM_COPY.cancel}
        confirmLabel={isSubmitting ? 'جاري الإنهاء…' : 'إنهاء اللعبة'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirm()}
      />

      <UiDialog
        open={confirmAction === 'leave-room'}
        title={SYSTEM_COPY.leaveConfirmTitle}
        description={SYSTEM_COPY.leaveConfirmBody}
        variant="warning"
        cancelLabel={SYSTEM_COPY.cancel}
        confirmLabel={isSubmitting ? SYSTEM_COPY.leaving : SYSTEM_COPY.leave}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}
