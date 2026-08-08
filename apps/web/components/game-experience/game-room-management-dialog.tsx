'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { UiDialog } from '@/components/ui/dialog';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { buildLobbyUrl } from '@/lib/room/session';
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
  const [copiedLink, setCopiedLink] = useState(false);
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
    if (!copiedLink) return;
    const id = window.setTimeout(() => setCopiedLink(false), 2000);
    return () => window.clearTimeout(id);
  }, [copiedLink]);

  useEffect(() => {
    if (!shareMessage) return;
    const id = window.setTimeout(() => setShareMessage(null), 2500);
    return () => window.clearTimeout(id);
  }, [shareMessage]);

  if (!open) {
    return null;
  }

  const invitePath = buildLobbyUrl(roomCode);
  const inviteUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${invitePath}` : invitePath;

  async function copyText(text: string, which: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'code') setCopiedCode(true);
      else setCopiedLink(true);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function handleShare() {
    const shareData = {
      title: 'وناستنا',
      text: `انضم إلى غرفتي! الرمز: ${roomCode}`,
      url: inviteUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await copyText(inviteUrl, 'link');
      setShareMessage('تم نسخ رابط الدعوة');
    } catch {
      /* user cancelled share */
    }
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
        <div className="absolute inset-0 bg-black/50" aria-hidden />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-room-management-title"
          className={cn(
            'relative z-10 w-full max-w-md rounded-2xl border p-5 shadow-xl',
            'border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-panel-bg)]',
            'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2
                id="game-room-management-title"
                className="text-base font-semibold text-[color:var(--wanas-game-text-primary)]"
              >
                إدارة الغرفة
              </h2>
              <p className="mt-1 text-sm text-[color:var(--wanas-game-text-secondary)]">{gameName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-9 min-h-9 min-w-9 items-center justify-center rounded-lg text-[color:var(--wanas-game-text-secondary)] hover:bg-[color:var(--wanas-game-structural-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wanas-game-accent)]"
              aria-label="إغلاق"
            >
              ✕
            </button>
          </div>

          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-medium text-[color:var(--wanas-game-text-secondary)]">رمز الغرفة</dt>
              <dd className="mt-1 flex items-center gap-2">
                <span className="font-mono text-lg font-bold tracking-widest text-[color:var(--wanas-game-text-primary)]">
                  {roomCode}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="min-h-9"
                  onClick={() => void copyText(roomCode, 'code')}
                >
                  {copiedCode ? 'تم النسخ' : 'نسخ الرمز'}
                </Button>
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-[color:var(--wanas-game-text-secondary)]">رابط الدعوة</dt>
              <dd className="mt-1 flex flex-col gap-2 sm:flex-row">
                <span className="min-w-0 flex-1 truncate rounded-lg border border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] px-3 py-2 text-xs text-[color:var(--wanas-game-text-secondary)]">
                  {inviteUrl}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="min-h-9 shrink-0"
                  onClick={() => void copyText(inviteUrl, 'link')}
                >
                  {copiedLink ? 'تم النسخ' : 'نسخ الرابط'}
                </Button>
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-col gap-2">
            <Button type="button" className="min-h-11 w-full" onClick={() => void handleShare()}>
              مشاركة الدعوة
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full border-[color:var(--wanas-error-border)] text-[color:var(--wanas-error)]"
              onClick={() => setConfirmAction('end-game')}
            >
              إنهاء اللعبة
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full"
              onClick={() => setConfirmAction('leave-room')}
            >
              مغادرة الغرفة
            </Button>
            <Button type="button" variant="secondary" className="min-h-11 w-full" onClick={onClose}>
              إغلاق
            </Button>
          </div>

          {shareMessage ? (
            <p className="mt-3 text-center text-xs text-[color:var(--wanas-game-text-secondary)]" role="status">
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
        confirmLabel={isSubmitting ? 'جاري الإنهاء…' : 'إنهاء اللعبة'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirm()}
      />

      <UiDialog
        open={confirmAction === 'leave-room'}
        title="مغادرة الغرفة؟"
        description="ستخرج من المباراة والغرفة الحالية."
        variant="warning"
        confirmLabel={isSubmitting ? 'جاري المغادرة…' : 'مغادرة الغرفة'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}
