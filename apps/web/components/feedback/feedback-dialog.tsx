'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  FEEDBACK_MESSAGE_MAX_LENGTH,
  FEEDBACK_MESSAGE_MIN_LENGTH,
  type FeedbackCategory,
  type FeedbackSource,
} from '@wanasatna/shared';
import { Button } from '@/components/ui/button';
import { submitFeedback } from '@/lib/feedback/api';
import { PUBLIC_EXTERNAL_LINKS } from '@/lib/public/external-links';
import { cn } from '@/lib/utils';

type FeedbackDialogProps = {
  open: boolean;
  onClose: () => void;
  source: FeedbackSource;
  roomId?: string | null;
  gameId?: string | null;
  initialView?: 'choices' | 'form';
};

const CATEGORIES: Array<{ value: FeedbackCategory; label: string }> = [
  { value: 'SUGGESTION', label: 'اقتراح' },
  { value: 'PROBLEM', label: 'مشكلة' },
  { value: 'OTHER', label: 'أخرى' },
];

function createSubmissionId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const value = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function MessageIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 5.5h14v10H9l-4 3v-13Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function FeedbackDialog({
  open,
  onClose,
  source,
  roomId,
  gameId,
  initialView = 'choices',
}: FeedbackDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const pendingRef = useRef(false);
  const [view, setView] = useState<'choices' | 'form' | 'success'>(initialView);
  const [category, setCategory] = useState<FeedbackCategory>('SUGGESTION');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submissionIdRef = useRef('');

  useEffect(() => {
    if (!open) {
      return;
    }

    pendingRef.current = false;
    submissionIdRef.current = createSubmissionId();
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>('button, a, select, textarea')?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pendingRef.current) {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) {
        return;
      }
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [initialView, onClose, open]);

  if (!open) {
    return null;
  }

  async function handleSubmit() {
    if (pendingRef.current) {
      return;
    }
    const trimmed = message.trim();
    if (trimmed.length < FEEDBACK_MESSAGE_MIN_LENGTH) {
      setError('اكتب ملاحظة من 3 أحرف على الأقل.');
      return;
    }
    if (trimmed.length > FEEDBACK_MESSAGE_MAX_LENGTH) {
      setError(`الملاحظة أطول من الحد المسموح (${FEEDBACK_MESSAGE_MAX_LENGTH} حرف).`);
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setError(null);
    const result = await submitFeedback({
      category,
      message: trimmed,
      source,
      ...(roomId ? { roomId } : {}),
      ...(gameId ? { gameId } : {}),
      route: window.location.pathname,
      submissionId: submissionIdRef.current,
    });
    pendingRef.current = false;
    setPending(false);

    if (!result.success) {
      setError(result.error.message);
      return;
    }
    setView('success');
  }

  const title =
    view === 'choices' ? 'ملاحظات' : view === 'form' ? 'أرسل ملاحظة' : 'وصلتنا ملاحظتك 💙';
  const description =
    view === 'choices'
      ? 'اختر الطريقة الأنسب للتواصل معنا.'
      : view === 'form'
        ? 'اختر النوع واكتب رسالتك، والباقي علينا.'
        : 'شكراً لمساعدتنا في تحسين وناستنا.';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        aria-label="إغلاق نافذة الملاحظات"
        className="bg-wanas-text-primary/55 absolute inset-0 backdrop-blur-[2px]"
        onClick={() => {
          if (!pendingRef.current) onClose();
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        dir="rtl"
        className="border-wanas-border bg-wanas-surface relative max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-[var(--wanas-radius-panel)] border p-5 shadow-[var(--wanas-shadow-panel)] sm:p-6"
      >
        <button
          type="button"
          aria-label="إغلاق"
          disabled={pending}
          onClick={onClose}
          className="text-wanas-text-muted hover:bg-wanas-surface-soft focus-visible:ring-wanas-accent/40 absolute end-3 top-3 inline-flex size-10 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2"
        >
          ✕
        </button>
        <div className="bg-wanas-primary-surface text-wanas-accent mb-4 flex size-12 items-center justify-center rounded-2xl">
          {view === 'success' ? <span aria-hidden>✓</span> : <MessageIcon />}
        </div>
        <h2 id={titleId} className="text-wanas-text-primary pe-10 text-xl font-bold leading-7">
          {title}
        </h2>
        <p id={descriptionId} className="text-wanas-text-secondary mt-2 text-sm leading-7">
          {description}
        </p>

        {view === 'choices' ? (
          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => setView('form')}
              className="border-wanas-border bg-wanas-surface-soft hover:border-wanas-accent focus-visible:ring-wanas-accent/40 rounded-2xl border p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              <span className="text-wanas-text-primary block font-bold">أرسل ملاحظة</span>
              <span className="text-wanas-text-secondary mt-1 block text-sm leading-6">
                عندك اقتراح أو واجهتك مشكلة؟ أرسلها لنا مباشرة.
              </span>
            </button>
            <a
              href={PUBLIC_EXTERNAL_LINKS.discordInvite}
              target="_blank"
              rel="noreferrer"
              className="border-wanas-border bg-wanas-surface-soft hover:border-wanas-accent focus-visible:ring-wanas-accent/40 rounded-2xl border p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              <span className="text-wanas-text-primary block font-bold">
                انضم إلى <bdi dir="ltr">Discord</bdi>
              </span>
              <span className="text-wanas-text-secondary mt-1 block text-sm leading-6">
                شاركنا اقتراحاتك وتواصل معنا في سيرفر وناستنا.
              </span>
            </a>
          </div>
        ) : null}

        {view === 'form' ? (
          <form
            className="mt-6 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <fieldset disabled={pending}>
              <legend className="text-wanas-text-primary text-sm font-bold">النوع</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {CATEGORIES.map((item) => (
                  <label
                    key={item.value}
                    className={cn(
                      'focus-within:ring-wanas-accent/40 cursor-pointer rounded-xl border px-2 py-2.5 text-center text-sm font-semibold transition-colors focus-within:ring-2',
                      category === item.value
                        ? 'border-wanas-accent bg-wanas-primary-surface text-wanas-accent'
                        : 'border-wanas-border text-wanas-text-secondary hover:bg-wanas-surface-soft',
                    )}
                  >
                    <input
                      type="radio"
                      name="feedback-category"
                      value={item.value}
                      checked={category === item.value}
                      onChange={() => setCategory(item.value)}
                      className="sr-only"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="text-wanas-text-primary block text-sm font-bold">
              الملاحظة
              <textarea
                value={message}
                disabled={pending}
                maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
                rows={6}
                placeholder="اكتب ملاحظتك هنا..."
                onChange={(event) => {
                  setMessage(event.target.value);
                  if (error) setError(null);
                }}
                className="border-wanas-border bg-wanas-surface text-wanas-text-primary placeholder:text-wanas-text-muted focus:border-wanas-accent focus:ring-wanas-accent/20 mt-2 min-h-32 w-full resize-y rounded-xl border px-3 py-3 text-base font-normal leading-7 outline-none focus:ring-2 disabled:opacity-60"
              />
              <span className="text-wanas-text-muted mt-1 block text-end text-xs font-normal">
                {message.length}/{FEEDBACK_MESSAGE_MAX_LENGTH}
              </span>
            </label>
            {error ? (
              <p
                role="alert"
                className="border-wanas-error-border bg-wanas-error-surface text-wanas-error rounded-xl border px-3 py-2 text-sm font-semibold"
              >
                {error}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setView(initialView === 'form' ? 'choices' : initialView);
                }}
              >
                رجوع
              </Button>
              <Button type="submit" className="flex-1" loading={pending}>
                إرسال الملاحظة
              </Button>
            </div>
          </form>
        ) : null}

        {view === 'success' ? (
          <Button className="mt-6 w-full" onClick={onClose}>
            إغلاق
          </Button>
        ) : null}
      </div>
    </div>
  );
}
