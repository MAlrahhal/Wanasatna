'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { playerNameContainsForbiddenChars } from '@wanasatna/shared';
import { FeatureCard } from '@/components/public/feature-card';
import { GuardedPublicLink } from '@/components/public/guarded-public-link';
import { PageHero } from '@/components/public/page-hero';
import { PublicField } from '@/components/public/public-field';
import { useAuth } from '@/contexts/auth-context';
import { AUTH_COPY } from '@/lib/auth/copy';
import { presentAuthError } from '@/lib/auth/error-messages';
import { PUBLIC_ROUTES } from '@/lib/public/routes';
import { cn } from '@/lib/utils';

const accountUses: { title: string; description?: string; accent: 'cyan' | 'blue' }[] = [
  { title: AUTH_COPY.saveNameTitle, description: AUTH_COPY.benefit, accent: 'cyan' },
  { title: AUTH_COPY.guestStillPlays, accent: 'blue' },
];

type AuthMode = 'login' | 'register';

export function LoginPageClient() {
  const router = useRouter();
  const { status, user, login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [preferredDisplayName, setPreferredDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'ready' && user) {
      router.replace(PUBLIC_ROUTES.home);
    }
  }, [status, user, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (isSubmitting || status !== 'ready' || user) {
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

    if (mode === 'register') {
      const name = preferredDisplayName.trim();
      if (name.length < 2 || name.length > 20) {
        setErrorMessage(AUTH_COPY.invalidName);
        return;
      }
      if (playerNameContainsForbiddenChars(name)) {
        setErrorMessage(AUTH_COPY.invalidNameChars);
        return;
      }
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result =
        mode === 'register'
          ? await register({
              email: trimmedEmail,
              password,
              preferredDisplayName: preferredDisplayName.trim(),
            })
          : await login(trimmedEmail, password);

      if (!result.success) {
        setErrorMessage(presentAuthError(result.error));
        return;
      }

      setPassword('');
      if ('mfaRequired' in result.data) {
        setErrorMessage(AUTH_COPY.adminMfaRequired);
        return;
      }
      router.replace(PUBLIC_ROUTES.home);
    } catch {
      setErrorMessage(AUTH_COPY.connectionFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  const showForm = status === 'ready' && !user;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHero
        title={mode === 'register' ? AUTH_COPY.registerTitle : AUTH_COPY.loginTitle}
        description={AUTH_COPY.pageDescription}
        variant="compact"
        className="mb-8"
      />

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {accountUses.map((item) => (
          <FeatureCard
            key={item.title}
            title={item.title}
            description={item.description}
            accent={item.accent}
          />
        ))}
      </div>

      <div className="border-wanas-border bg-wanas-surface mx-auto max-w-md space-y-4 rounded-[24px] border p-6 shadow-sm">
        {status === 'loading' || user ? (
          <p className="text-wanas-text-muted text-center text-sm">{AUTH_COPY.resolvingSession}</p>
        ) : (
          <>
            <div
              role="tablist"
              aria-label="اختيار نوع الحساب"
              className="border-wanas-border bg-wanas-surface-soft grid grid-cols-2 gap-1 rounded-2xl border p-1"
            >
              {(['login', 'register'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={mode === tab}
                  onClick={() => {
                    setMode(tab);
                    setErrorMessage(null);
                  }}
                  className={cn(
                    'inline-flex h-10 items-center justify-center rounded-xl text-sm font-semibold transition-colors',
                    'focus-visible:ring-wanas-accent/30 focus-visible:outline-none focus-visible:ring-2',
                    mode === tab
                      ? 'bg-wanas-surface text-wanas-text-primary shadow-sm'
                      : 'text-wanas-text-muted hover:text-wanas-text-primary',
                  )}
                >
                  {tab === 'login' ? AUTH_COPY.loginTitle : AUTH_COPY.registerTitle}
                </button>
              ))}
            </div>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="space-y-4"
              aria-busy={isSubmitting}
              aria-describedby={errorMessage ? 'auth-form-error' : undefined}
            >
              {errorMessage ? (
                <div
                  id="auth-form-error"
                  role="alert"
                  className="border-wanas-error-border bg-wanas-error-surface text-wanas-error rounded-2xl border px-4 py-3 text-sm"
                >
                  {errorMessage}
                </div>
              ) : null}

              {mode === 'register' ? (
                <PublicField
                  id="register-name"
                  label={AUTH_COPY.nameLabel}
                  value={preferredDisplayName}
                  onChange={setPreferredDisplayName}
                  placeholder="اسمك"
                  name="name"
                  autoComplete="name"
                  disabled={isSubmitting || !showForm}
                />
              ) : null}

              <PublicField
                id="login-email"
                label={AUTH_COPY.emailLabel}
                value={email}
                onChange={setEmail}
                placeholder="example@email.com"
                type="email"
                inputMode="email"
                name="email"
                autoComplete="email"
                disabled={isSubmitting || !showForm}
              />
              <PublicField
                id="login-password"
                label={AUTH_COPY.passwordLabel}
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                type="password"
                name="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                disabled={isSubmitting || !showForm}
              />
              <button
                type="submit"
                disabled={isSubmitting || !showForm}
                className={cn(
                  'bg-wanas-accent hover:bg-wanas-accent-hover inline-flex h-12 w-full items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  'focus-visible:ring-wanas-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                )}
              >
                {isSubmitting
                  ? AUTH_COPY.submitting
                  : mode === 'register'
                    ? AUTH_COPY.registerCta
                    : AUTH_COPY.loginCta}
              </button>
            </form>
          </>
        )}
      </div>

      <div className="mt-8 text-center">
        <GuardedPublicLink
          href={PUBLIC_ROUTES.home}
          className={cn(
            'border-wanas-border bg-wanas-surface-soft text-wanas-primary-dark inline-flex h-12 items-center justify-center rounded-2xl border px-6 text-sm font-bold',
            'hover:bg-wanas-surface focus-visible:ring-wanas-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          )}
        >
          {AUTH_COPY.playAsGuest}
        </GuardedPublicLink>
      </div>
    </main>
  );
}
