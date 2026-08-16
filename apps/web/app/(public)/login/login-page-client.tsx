'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ComingSoonNotice } from '@/components/public/coming-soon-notice';
import { PublicField } from '@/components/public/public-field';
import { PageHero } from '@/components/public/page-hero';
import { FeatureCard } from '@/components/public/feature-card';
import { PUBLIC_ROUTES } from '@/lib/public/routes';
import { cn } from '@/lib/utils';

const accountUses = [
  { title: 'حفظ الاسم المفضّل', accent: 'cyan' as const },
  { title: 'اللعب بدون حساب يبقى متاحاً', accent: 'blue' as const },
];

export function LoginPageClient() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function openSoon(title: string) {
    setDialogTitle(title);
    setDialogOpen(true);
  }

  function handleLogin(event: React.FormEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('يرجى إدخال بريد إلكتروني صالح.');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('يرجى إدخال كلمة المرور.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      openSoon('تسجيل الدخول قريباً');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHero
        title="تسجيل الدخول"
        description="تسجيل الدخول قيد التطوير. يمكنك اللعب الآن بدون حساب. عند تفعيل الحساب، سيُحفظ اسمك المفضّل."
        variant="compact"
        className="mb-8"
      />

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {accountUses.map((item) => (
          <FeatureCard key={item.title} title={item.title} accent={item.accent} />
        ))}
      </div>

      <form
        onSubmit={handleLogin}
        noValidate
        className="mx-auto max-w-md space-y-4 rounded-[24px] border border-wanas-border bg-wanas-surface p-6 shadow-sm"
      >
        {errorMessage ? (
          <div role="alert" className="rounded-2xl border border-wanas-error-border bg-wanas-error-surface px-4 py-3 text-sm text-wanas-error">
            {errorMessage}
          </div>
        ) : null}

        <PublicField
          id="login-email"
          label="البريد الإلكتروني"
          value={email}
          onChange={setEmail}
          placeholder="example@email.com"
          type="email"
          inputMode="email"
          disabled={isSubmitting}
        />
        <PublicField
          id="login-password"
          label="كلمة المرور"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          type="password"
          disabled={isSubmitting}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'inline-flex h-12 w-full items-center justify-center rounded-2xl bg-wanas-accent text-sm font-bold text-white shadow-sm hover:bg-wanas-accent-hover',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {isSubmitting ? 'جاري التحقق...' : 'تسجيل الدخول'}
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            onClick={() => openSoon('إنشاء حساب قريباً')}
            className="font-semibold text-wanas-primary-dark hover:underline"
          >
            إنشاء حساب
          </button>
          <button
            type="button"
            onClick={() => openSoon('استعادة كلمة المرور قريباً')}
            className="font-semibold text-wanas-text-muted hover:text-wanas-primary-dark"
          >
            نسيت كلمة المرور؟
          </button>
        </div>
      </form>

      <div className="mt-8 text-center">
        <Link
          href={PUBLIC_ROUTES.home}
          className={cn(
            'inline-flex h-12 items-center justify-center rounded-2xl border border-wanas-border bg-wanas-surface-soft px-6 text-sm font-bold text-wanas-primary-dark',
            'hover:bg-wanas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/30 focus-visible:ring-offset-2',
          )}
        >
          العب بدون حساب
        </Link>
      </div>

      <ComingSoonNotice
        open={dialogOpen}
        title={dialogTitle}
        description="هذه الميزة قيد التطوير. يمكنك اللعب الآن بدون حساب من الصفحة الرئيسية."
        onClose={() => setDialogOpen(false)}
      />
    </main>
  );
}
