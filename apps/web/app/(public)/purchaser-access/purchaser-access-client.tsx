'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import type { AuthError } from '@wanasatna/shared';
import { GuardedPublicLink } from '@/components/public/guarded-public-link';
import { PageHero } from '@/components/public/page-hero';
import { MailIcon, PublicField } from '@/components/public/public-field';
import { useAuth } from '@/contexts/auth-context';
import { PUBLIC_ROUTES } from '@/lib/public/routes';
import { requestPurchaserOtpCode } from '@/lib/purchaser-access/api';
import { PURCHASER_ACCESS_COPY } from '@/lib/purchaser-access/copy';
import { cn } from '@/lib/utils';

type Step = 'email' | 'code';

function presentError(error: AuthError): string {
  switch (error.code) {
    case 'OTP_INVALID':
      return PURCHASER_ACCESS_COPY.rejectedCode;
    case 'RATE_LIMITED':
      return PURCHASER_ACCESS_COPY.rateLimited;
    case 'EMAIL_DELIVERY_UNAVAILABLE':
      return PURCHASER_ACCESS_COPY.deliveryUnavailable;
    case 'VALIDATION_ERROR':
      return /[\u0600-\u06FF]/.test(error.message)
        ? error.message
        : PURCHASER_ACCESS_COPY.genericError;
    case 'INTERNAL_ERROR':
      return error.message === PURCHASER_ACCESS_COPY.connectionFailed
        ? PURCHASER_ACCESS_COPY.connectionFailed
        : PURCHASER_ACCESS_COPY.genericError;
    default:
      return PURCHASER_ACCESS_COPY.genericError;
  }
}

export function PurchaserAccessClient() {
  const router = useRouter();
  const { status, user, verifyPurchaserOtp } = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'ready' && user) {
      router.replace(PUBLIC_ROUTES.home);
    }
  }, [status, user, router]);

  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  useEffect(() => {
    if (step !== 'code') {
      return;
    }
    window.requestAnimationFrame(() => {
      document.getElementById('purchaser-code')?.focus();
    });
  }, [step]);

  async function requestCode() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorMessage(PURCHASER_ACCESS_COPY.invalidEmail);
      return;
    }

    setErrorMessage(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      const result = await requestPurchaserOtpCode(normalizedEmail);
      if (!result.success) {
        setErrorMessage(presentError(result.error));
        return;
      }

      setEmail(normalizedEmail);
      setChallengeId(result.data.challengeId);
      setResendSeconds(result.data.resendAfterSeconds);
      setNotice(
        result.data.delivery === 'pending'
          ? PURCHASER_ACCESS_COPY.pendingDelivery
          : PURCHASER_ACCESS_COPY.sentNotice,
      );
      setStep('code');
    } catch {
      setErrorMessage(PURCHASER_ACCESS_COPY.connectionFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isSubmitting && status === 'ready' && !user) {
      await requestCode();
    }
  }

  async function handleCodeSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting || !challengeId || status !== 'ready' || user) {
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setErrorMessage(PURCHASER_ACCESS_COPY.invalidCode);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const result = await verifyPurchaserOtp({ challengeId, code });
      if (!result.success) {
        setErrorMessage(presentError(result.error));
        return;
      }
      setCode('');
      router.replace(PUBLIC_ROUTES.home);
    } catch {
      setErrorMessage(PURCHASER_ACCESS_COPY.connectionFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  const showForm = status === 'ready' && !user;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-4xl px-4 py-10 outline-none sm:px-6 sm:py-12"
    >
      <PageHero
        title={PURCHASER_ACCESS_COPY.title}
        description={PURCHASER_ACCESS_COPY.description}
        variant="compact"
        className="mb-8"
      />

      <section className="border-wanas-border bg-wanas-surface mx-auto max-w-md space-y-5 rounded-[24px] border p-5 shadow-sm sm:p-6">
        {status === 'loading' || user ? (
          <p className="text-wanas-text-muted text-center text-sm">جاري التحقق من الجلسة…</p>
        ) : null}

        {showForm && step === 'email' ? (
          <form
            onSubmit={handleEmailSubmit}
            noValidate
            className="space-y-4"
            aria-busy={isSubmitting}
            aria-describedby={errorMessage ? 'purchaser-access-error' : undefined}
          >
            {errorMessage ? (
              <div
                id="purchaser-access-error"
                role="alert"
                className="border-wanas-error-border bg-wanas-error-surface text-wanas-error rounded-2xl border px-4 py-3 text-sm leading-6"
              >
                {errorMessage}
              </div>
            ) : null}

            <PublicField
              id="purchaser-email"
              label={PURCHASER_ACCESS_COPY.emailLabel}
              value={email}
              onChange={setEmail}
              placeholder="example@email.com"
              type="email"
              inputMode="email"
              name="email"
              autoComplete="email"
              icon={<MailIcon />}
              disabled={isSubmitting}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'bg-wanas-accent hover:bg-wanas-accent-hover inline-flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-bold text-white shadow-sm',
                'focus-visible:ring-wanas-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              {isSubmitting
                ? PURCHASER_ACCESS_COPY.requestingCode
                : PURCHASER_ACCESS_COPY.requestCode}
            </button>
          </form>
        ) : null}

        {showForm && step === 'code' ? (
          <form
            onSubmit={handleCodeSubmit}
            noValidate
            className="space-y-4"
            aria-busy={isSubmitting}
            aria-describedby={errorMessage ? 'purchaser-code-error' : 'purchaser-code-description'}
          >
            <div>
              <h2 className="text-wanas-text-primary text-lg font-bold">
                {PURCHASER_ACCESS_COPY.codeTitle}
              </h2>
              <p
                id="purchaser-code-description"
                className="text-wanas-text-muted mt-1 text-sm leading-6"
              >
                {PURCHASER_ACCESS_COPY.codeDescription}
              </p>
            </div>

            {notice ? (
              <p
                role="status"
                className="border-wanas-border bg-wanas-surface-soft text-wanas-text-secondary rounded-2xl border px-4 py-3 text-sm leading-6"
              >
                {notice}
              </p>
            ) : null}
            {errorMessage ? (
              <div
                id="purchaser-code-error"
                role="alert"
                className="border-wanas-error-border bg-wanas-error-surface text-wanas-error rounded-2xl border px-4 py-3 text-sm leading-6"
              >
                {errorMessage}
              </div>
            ) : null}

            <PublicField
              id="purchaser-code"
              label={PURCHASER_ACCESS_COPY.codeLabel}
              value={code}
              onChange={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              placeholder={PURCHASER_ACCESS_COPY.codePlaceholder}
              inputMode="numeric"
              name="one-time-code"
              autoComplete="one-time-code"
              inputClassName="text-center font-mono text-xl tracking-[0.35em] [direction:ltr]"
              disabled={isSubmitting}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'bg-wanas-accent hover:bg-wanas-accent-hover inline-flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-bold text-white shadow-sm',
                'focus-visible:ring-wanas-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              {isSubmitting
                ? PURCHASER_ACCESS_COPY.verifyingCode
                : PURCHASER_ACCESS_COPY.verifyCode}
            </button>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={isSubmitting || resendSeconds > 0}
                onClick={() => void requestCode()}
                className="border-wanas-border bg-wanas-surface-soft text-wanas-text-primary inline-flex min-h-11 items-center justify-center rounded-2xl border px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resendSeconds > 0
                  ? PURCHASER_ACCESS_COPY.resendIn(resendSeconds)
                  : PURCHASER_ACCESS_COPY.resend}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setStep('email');
                  setChallengeId(null);
                  setCode('');
                  setErrorMessage(null);
                  setNotice(null);
                }}
                className="border-wanas-border bg-wanas-surface-soft text-wanas-text-primary inline-flex min-h-11 items-center justify-center rounded-2xl border px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {PURCHASER_ACCESS_COPY.changeEmail}
              </button>
            </div>
          </form>
        ) : null}

        <p className="text-wanas-text-muted text-center text-xs leading-6">
          {PURCHASER_ACCESS_COPY.noEntitlementNotice}
        </p>
      </section>

      <div className="mt-8 text-center">
        <GuardedPublicLink
          href={PUBLIC_ROUTES.home}
          className="border-wanas-border bg-wanas-surface-soft text-wanas-primary-dark hover:bg-wanas-surface inline-flex h-12 items-center justify-center rounded-2xl border px-6 text-sm font-bold"
        >
          {PURCHASER_ACCESS_COPY.backHome}
        </GuardedPublicLink>
      </div>
    </main>
  );
}
