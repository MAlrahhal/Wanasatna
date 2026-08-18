'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
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
  const { status, user, login, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
  }

  const showForm = status === 'ready' && !checking && !denied;

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 outline-none sm:px-6">
      <h1 className="mb-6 text-center text-2xl font-bold text-wanas-text-primary">{ADMIN_COPY.loginTitle}</h1>

      {status === 'loading' || checking ? (
        <p className="text-center text-sm text-wanas-text-muted">{ADMIN_COPY.resolving}</p>
      ) : null}

      {denied ? (
        <div className="space-y-4 rounded-[24px] border border-wanas-border bg-wanas-surface p-6 shadow-sm">
          <p role="alert" className="text-center text-sm font-semibold text-wanas-error">
            {ADMIN_COPY.accessDenied}
          </p>
          <button
            type="button"
            onClick={() => {
              void handleDeniedLogout();
            }}
            className={cn(
              'inline-flex h-12 w-full items-center justify-center rounded-2xl border border-wanas-border bg-wanas-surface-soft px-6 text-sm font-bold text-wanas-text-primary',
              'hover:bg-wanas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/30',
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
          className="space-y-4 rounded-[24px] border border-wanas-border bg-wanas-surface p-6 shadow-sm"
          aria-busy={isSubmitting}
          aria-describedby={errorMessage ? 'admin-login-error' : undefined}
        >
          {errorMessage ? (
            <div
              id="admin-login-error"
              role="alert"
              className="rounded-2xl border border-wanas-error-border bg-wanas-error-surface px-4 py-3 text-sm text-wanas-error"
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
              'inline-flex h-12 w-full items-center justify-center rounded-2xl bg-wanas-accent text-sm font-bold text-white shadow-sm hover:bg-wanas-accent-hover',
              'disabled:cursor-not-allowed disabled:opacity-60',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/30 focus-visible:ring-offset-2',
            )}
          >
            {isSubmitting ? AUTH_COPY.submitting : ADMIN_COPY.loginCta}
          </button>
        </form>
      ) : null}
    </main>
  );
}
