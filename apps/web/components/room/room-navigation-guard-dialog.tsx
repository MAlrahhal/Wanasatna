'use client';

import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';

type RoomNavigationGuardDialogProps = {
  open: boolean;
  isLeaving: boolean;
  onStay: () => void;
  onLeaveAndContinue: () => void;
};

export function RoomNavigationGuardDialog({
  open,
  isLeaving,
  onStay,
  onLeaveAndContinue,
}: RoomNavigationGuardDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    stayRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLeaving) {
        onStay();
      }
    };

    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isLeaving, onStay, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="إغلاق"
        disabled={isLeaving}
        className="absolute inset-0 bg-wanas-text-primary/50"
        onClick={onStay}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-md rounded-xl border border-wanas-border bg-wanas-surface p-5 shadow-lg sm:p-6"
      >
        <h2 id={titleId} className="text-lg font-bold text-wanas-text-primary">
          أنت داخل غرفة حاليًا
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-7 text-wanas-text-secondary">
          إذا غادرت هذه الصفحة ستخرج من الغرفة الحالية.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse sm:gap-3">
          <button
            ref={stayRef}
            type="button"
            disabled={isLeaving}
            onClick={onStay}
            className={cn(
              'inline-flex h-11 min-h-[44px] flex-1 items-center justify-center rounded-xl bg-wanas-accent px-4 text-sm font-semibold text-[color:var(--wanas-background)]',
              'hover:bg-wanas-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/40 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            العودة للغرفة
          </button>
          <button
            type="button"
            disabled={isLeaving}
            onClick={onLeaveAndContinue}
            className={cn(
              'inline-flex h-11 min-h-[44px] flex-1 items-center justify-center rounded-xl border border-wanas-error-border bg-wanas-error-surface px-4 text-sm font-semibold text-wanas-error',
              'hover:bg-wanas-error-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-error/35 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {isLeaving ? 'جاري المغادرة...' : 'مغادرة الغرفة والمتابعة'}
          </button>
        </div>
      </div>
    </div>
  );
}
