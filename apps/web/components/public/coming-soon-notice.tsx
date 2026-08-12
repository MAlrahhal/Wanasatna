'use client';

import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';

type ComingSoonNoticeProps = {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
};

export function ComingSoonNotice({ open, title, description, onClose }: ComingSoonNoticeProps) {
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" aria-label="إغلاق" className="absolute inset-0 bg-wanas-text-primary/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-md rounded-[20px] border border-wanas-border bg-wanas-surface p-6 shadow-lg"
      >
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-wanas-primary-surface text-wanas-primary-dark">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <h2 id={titleId} className="text-xl font-bold text-wanas-text-primary">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-7 text-wanas-text-secondary">
          {description}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={cn(
            'mt-6 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-wanas-accent text-sm font-semibold text-white',
            'hover:bg-wanas-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/40 focus-visible:ring-offset-2',
          )}
        >
          حسناً
        </button>
      </div>
    </div>
  );
}

export function InlineComingSoonBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-wanas-border bg-wanas-surface-soft px-4 py-3 text-sm font-medium text-wanas-primary-dark"
    >
      {message}
    </div>
  );
}
