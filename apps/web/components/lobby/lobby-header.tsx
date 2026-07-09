'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

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

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
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
      window.setTimeout(() => setShareMessage(null), 2000);
    } catch {
      setShareMessage(null);
    }
  }

  return (
    <header className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">رمز الغرفة</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-2xl font-bold tracking-[0.2em] text-foreground">
              {roomCode}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                isLocked
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
              )}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {isLocked ? 'الغرفة مقفلة' : 'الغرفة مفتوحة'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {copied ? 'تم النسخ' : 'نسخ الرمز'}
          </button>
          <button
            type="button"
            onClick={handleShareRoom}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            مشاركة الغرفة
          </button>
          {isHost ? (
            isLocked ? (
              <button
                type="button"
                onClick={onUnlockRoom}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                فتح الغرفة
              </button>
            ) : (
              <button
                type="button"
                onClick={onLockRoom}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                قفل الغرفة
              </button>
            )
          ) : null}
          <button
            type="button"
            onClick={onLeaveRoom}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-destructive/30 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            مغادرة الغرفة
          </button>
          {shareMessage ? (
            <span className="text-xs text-muted-foreground">{shareMessage}</span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
