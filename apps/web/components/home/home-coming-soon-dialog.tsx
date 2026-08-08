'use client';

import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';

type HomeComingSoonDialogProps = {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
};

export function HomeComingSoonDialog({
  open,
  title,
  description,
  onClose,
}: HomeComingSoonDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="إغلاق"
        className="absolute inset-0 bg-[#0F172A]/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <h2 id={titleId} className="text-xl font-bold text-[#0F172A]">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-7 text-[#64748B]">
          {description}
        </p>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className={cn(
            'mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#3B82F6] px-5 text-sm font-semibold text-white transition-colors',
            'hover:bg-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40 focus-visible:ring-offset-2',
          )}
        >
          حسناً
        </button>
      </div>
    </div>
  );
}
