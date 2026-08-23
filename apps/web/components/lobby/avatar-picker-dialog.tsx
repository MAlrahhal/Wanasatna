'use client';

import { useEffect, useId, useRef } from 'react';
import type { PlayerAvatarId } from '@wanasatna/shared';
import { PlayerAvatar } from '@/components/player/player-avatar';
import { playerAvatarCatalog } from '@/lib/avatars/catalog';
import { cn } from '@/lib/utils';

type AvatarPickerDialogProps = {
  open: boolean;
  playerId: string;
  playerName: string;
  selectedAvatarId: PlayerAvatarId;
  onSelect: (avatarId: PlayerAvatarId) => void;
  onClose: () => void;
};

export function AvatarPickerDialog({
  open,
  playerId,
  playerName,
  selectedAvatarId,
  onSelect,
  onClose,
}: AvatarPickerDialogProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        aria-label="إغلاق اختيار الصورة"
        className="bg-wanas-text-primary/50 absolute inset-0"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        dir="rtl"
        className="border-wanas-border bg-wanas-surface relative flex max-h-[min(86dvh,720px)] w-full max-w-lg flex-col rounded-[var(--wanas-radius-panel)] border p-4 shadow-[var(--wanas-shadow-panel)] sm:p-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-wanas-text-primary text-lg font-bold">
              اختر صورتك
            </h2>
            <p className="text-wanas-text-muted mt-1 text-xs">يمكنك تغييرها قبل بدء اللعبة.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="إغلاق"
            className="border-wanas-border text-wanas-text-muted flex size-11 shrink-0 items-center justify-center rounded-xl border"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="grid min-h-0 grid-cols-4 gap-2 overflow-y-auto p-1 sm:grid-cols-6 sm:gap-3">
          {playerAvatarCatalog.map((avatar) => {
            const selected = avatar.id === selectedAvatarId;
            return (
              <button
                key={avatar.id}
                type="button"
                aria-label={`اختيار الصورة ${avatar.id.slice(-2)}`}
                aria-pressed={selected}
                className={cn(
                  'focus-visible:ring-wanas-accent relative aspect-square rounded-full outline-none transition-transform focus-visible:ring-2',
                  selected
                    ? 'ring-wanas-accent scale-95 ring-4'
                    : 'hover:ring-wanas-accent/35 hover:scale-105 hover:ring-2',
                )}
                onClick={() => onSelect(avatar.id)}
              >
                <PlayerAvatar
                  playerId={playerId}
                  avatarId={avatar.id}
                  playerName={playerName}
                  className="h-full w-full"
                  sizes="(max-width: 640px) 22vw, 72px"
                />
                {selected ? (
                  <span className="bg-wanas-accent ring-wanas-surface absolute -bottom-0.5 -start-0.5 flex size-6 items-center justify-center rounded-full text-xs font-bold text-white ring-2">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
