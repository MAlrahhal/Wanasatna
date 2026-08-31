'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import type { AdminMfaMethod } from '@wanasatna/shared';
import { PublicField } from '@/components/public/public-field';
import { useAuth } from '@/contexts/auth-context';
import { fetchAdminMe } from '@/lib/admin/api';
import { ADMIN_COPY } from '@/lib/admin/copy';
import { ADMIN_ROUTES } from '@/lib/admin/routes';
import { presentAuthError } from '@/lib/auth/error-messages';
import { AUTH_COPY } from '@/lib/auth/copy';
import { cn } from '@/lib/utils';

export function AdminLoginClient() {
  const router = useRouter();
  const { status, user, login, verifyAdminMfa, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [mfaMethod, setMfaMethod] = useState<AdminMfaMethod>('totp');
  const [mfaCode, setMfaCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    let cancelled = false;

    void fetchAdminMe().then((result) => {
      if (cancelled) {
        return;
      }

      if (result.ok) {
        router.replace(ADMIN_ROUTES.root);
        return;
      }

      setDenied(result.status === 403);
      setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [status, user?.id, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (isSubmitting || status !== 'ready') {
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage(AUTH_COPY.invalidEmail);
      return;
    }

    if (password.length < 8) {
      setErrorMessage(AUTH_COPY.passwordTooShort);
      return;
    }

    if (password.length > 128) {
      setErrorMessage(AUTH_COPY.passwordTooLong);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await login(trimmedEmail, password);
      if (!result.success) {
        setErrorMessage(presentAuthError(result.error));
        return;
      }

      setPassword('');
      if ('mfaRequired' in result.data) {
        setChallengeToken(result.data.challengeToken);
        setMfaMethod('totp');
        setMfaCode('');
        return;
      }

      const admin = await fetchAdminMe();
      if (admin.ok) {
        router.replace(ADMIN_ROUTES.root);
        return;
      }

      setDenied(true);
    } catch {
      setErrorMessage(AUTH_COPY.connectionFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent) {
    event.preventDefault();

    if (isSubmitting || !challengeToken) {
      return;
    }

    const code = mfaCode.trim();
    if ((mfaMethod === 'totp' && !/^\d{6}$/.test(code)) || !code) {
      setErrorMessage(ADMIN_COPY.mfaInvalidCode);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await verifyAdminMfa({ challengeToken, method: mfaMethod, code });
      if (!result.success) {
        setErrorMessage(
          result.error.code === 'RATE_LIMITED' || result.error.code === 'INTERNAL_ERROR'
            ? presentAuthError(result.error)
            : ADMIN_COPY.mfaVerificationFailed,
        );
        return;
      }

      setChallengeToken(null);
      setMfaCode('');
      const admin = await fetchAdminMe();
      if (admin.ok) {
        router.replace(ADMIN_ROUTES.root);
        return;
      }

      setDenied(true);
    } catch {
      setErrorMessage(AUTH_COPY.connectionFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeniedLogout() {
    await logout();
    setDenied(false);
    setErrorMessage(null);
    setEmail('');
    setPassword('');
    setChallengeToken(null);
    setMfaCode('');
  }

  const showForm = status === 'ready' && !checking && !denied && !challengeToken;
  const showMfaForm = status === 'ready' && !checking && !denied && challengeToken;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 outline-none sm:px-6"
    >
      <h1 className="text-wanas-text-primary mb-6 text-center text-2xl font-bold">
        {ADMIN_COPY.loginTitle}
      </h1>

      {status === 'loading' || checking ? (
        <p className="text-wanas-text-muted text-center text-sm">{ADMIN_COPY.resolving}</p>
      ) : null}

      {denied ? (
        <div className="border-wanas-border bg-wanas-surface space-y-4 rounded-[24px] border p-6 shadow-sm">
          <p role="alert" className="text-wanas-error text-center text-sm font-semibold">
            {ADMIN_COPY.accessDenied}
          </p>
          <button
            type="button"
            onClick={() => {
              void handleDeniedLogout();
            }}
            className={cn(
              'border-wanas-border bg-wanas-surface-soft text-wanas-text-primary inline-flex h-12 w-full items-center justify-center rounded-2xl border px-6 text-sm font-bold',
              'hover:bg-wanas-surface focus-visible:ring-wanas-accent/30 focus-visible:outline-none focus-visible:ring-2',
            )}
          >
            {ADMIN_COPY.logout}
          </button>
        </div>
      ) : null}

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="border-wanas-border bg-wanas-surface space-y-4 rounded-[24px] border p-6 shadow-sm"
          aria-busy={isSubmitting}
          aria-describedby={errorMessage ? 'admin-login-error' : undefined}
        >
          {errorMessage ? (
            <div
              id="admin-login-error"
              role="alert"
              className="border-wanas-error-border bg-wanas-error-surface text-wanas-error rounded-2xl border px-4 py-3 text-sm"
            >
              {errorMessage}
            </div>
          ) : null}

          <PublicField
            id="admin-login-email"
            label={ADMIN_COPY.emailLabel}
            value={email}
            onChange={setEmail}
            placeholder="example@email.com"
            type="email"
            inputMode="email"
            name="email"
            autoComplete="email"
            disabled={isSubmitting}
          />
          <PublicField
            id="admin-login-password"
            label={ADMIN_COPY.passwordLabel}
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            type="password"
            name="password"
            autoComplete="current-password"
            disabled={isSubmitting}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'bg-wanas-accent hover:bg-wanas-accent-hover inline-flex h-12 w-full items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm',
              'disabled:cursor-not-allowed disabled:opacity-60',
              'focus-visible:ring-wanas-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            )}
          >
            {isSubmitting ? AUTH_COPY.submitting : ADMIN_COPY.loginCta}
          </button>
        </form>
      ) : null}

      {showMfaForm ? (
        <form
          onSubmit={handleMfaSubmit}
          noValidate
          className="border-wanas-border bg-wanas-surface space-y-4 rounded-[24px] border p-6 shadow-sm"
          aria-busy={isSubmitting}
          aria-describedby={errorMessage ? 'admin-mfa-error' : 'admin-mfa-description'}
        >
          <div>
            <h2 className="text-wanas-text-primary text-lg font-bold">{ADMIN_COPY.mfaTitle}</h2>
            <p id="admin-mfa-description" className="text-wanas-text-muted mt-1 text-sm">
              {ADMIN_COPY.mfaDescription}
            </p>
          </div>

          {errorMessage ? (
            <div
              id="admin-mfa-error"
              role="alert"
              className="border-wanas-error-border bg-wanas-error-surface text-wanas-error rounded-2xl border px-4 py-3 text-sm"
            >
              {errorMessage}
            </div>
          ) : null}

          <div
            role="group"
            aria-label={ADMIN_COPY.mfaMethodLabel}
            className="border-wanas-border bg-wanas-surface-soft grid grid-cols-2 gap-1 rounded-2xl border p-1"
          >
            {(['totp', 'recovery'] as const).map((method) => (
              <button
                key={method}
                type="button"
                aria-pressed={mfaMethod === method}
                onClick={() => {
                  setMfaMethod(method);
                  setMfaCode('');
                  setErrorMessage(null);
                }}
                disabled={isSubmitting}
                className={cn(
                  'inline-flex h-10 items-center justify-center rounded-xl px-2 text-sm font-semibold transition-colors',
                  'focus-visible:ring-wanas-accent/30 focus-visible:outline-none focus-visible:ring-2',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  mfaMethod === method
                    ? 'bg-wanas-surface text-wanas-text-primary shadow-sm'
                    : 'text-wanas-text-muted hover:text-wanas-text-primary',
                )}
              >
                {method === 'totp' ? ADMIN_COPY.mfaTotpOption : ADMIN_COPY.mfaRecoveryOption}
              </button>
            ))}
          </div>

          <PublicField
            id="admin-mfa-code"
            label={mfaMethod === 'totp' ? ADMIN_COPY.mfaCodeLabel : ADMIN_COPY.mfaRecoveryLabel}
            value={mfaCode}
            onChange={(value) =>
              setMfaCode(
                mfaMethod === 'totp' ? value.replace(/\D/g, '').slice(0, 6) : value.slice(0, 128),
              )
            }
            placeholder={
              mfaMethod === 'totp'
                ? ADMIN_COPY.mfaCodePlaceholder
                : ADMIN_COPY.mfaRecoveryPlaceholder
            }
            inputMode={mfaMethod === 'totp' ? 'numeric' : 'text'}
            name="mfa-code"
            autoComplete={mfaMethod === 'totp' ? 'one-time-code' : 'off'}
            disabled={isSubmitting}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'bg-wanas-accent hover:bg-wanas-accent-hover inline-flex h-12 w-full items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm',
              'disabled:cursor-not-allowed disabled:opacity-60',
              'focus-visible:ring-wanas-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            )}
          >
            {isSubmitting ? AUTH_COPY.submitting : ADMIN_COPY.mfaVerifyCta}
          </button>

          <button
            type="button"
            onClick={() => {
              setChallengeToken(null);
              setMfaCode('');
              setErrorMessage(null);
            }}
            disabled={isSubmitting}
            className={cn(
              'border-wanas-border bg-wanas-surface-soft text-wanas-text-primary inline-flex h-11 w-full items-center justify-center rounded-2xl border px-6 text-sm font-bold',
              'hover:bg-wanas-surface disabled:cursor-not-allowed disabled:opacity-60',
              'focus-visible:ring-wanas-accent/30 focus-visible:outline-none focus-visible:ring-2',
            )}
          >
            {ADMIN_COPY.mfaBack}
          </button>
        </form>
      ) : null}
    </main>
  );
}
