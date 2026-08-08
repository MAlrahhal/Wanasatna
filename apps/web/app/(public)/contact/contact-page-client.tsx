'use client';

import { useState } from 'react';
import { InlineComingSoonBanner } from '@/components/public/coming-soon-notice';
import { FeatureCard } from '@/components/public/feature-card';
import { MailIcon, PublicField, UserIcon } from '@/components/public/public-field';
import { PageHero } from '@/components/public/page-hero';
import { cn } from '@/lib/utils';

const reasons = [
  { title: 'مشكلة تقنية', accent: 'blue' as const },
  { title: 'اقتراح لعبة', accent: 'purple' as const },
  { title: 'تعاون أو شراكة', accent: 'orange' as const },
  { title: 'ملاحظات عامة', accent: 'cyan' as const },
];

export function ContactPageClient() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  function resetForm() {
    setSubmitted(false);
    setErrorMessage(null);
    setName('');
    setEmail('');
    setReason('');
    setMessage('');
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName) {
      setErrorMessage('يرجى إدخال اسمك.');
      return;
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('يرجى إدخال بريد إلكتروني صالح.');
      return;
    }

    if (!reason) {
      setErrorMessage('يرجى اختيار سبب التواصل.');
      return;
    }

    if (!trimmedMessage) {
      setErrorMessage('يرجى كتابة رسالتك.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHero
        title="تواصل معنا"
        description="نرحب بأسئلتك واقتراحاتك — فريق الدعم سيكون متاحاً قريباً."
        variant="compact"
        className="mb-10"
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {reasons.map((item) => (
          <FeatureCard key={item.title} title={item.title} accent={item.accent} />
        ))}
      </div>

      {submitted ? (
        <div className="space-y-4">
          <InlineComingSoonBanner message="الخدمة ستتوفر قريباً — شكراً لتواصلك معنا." />
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-wanas-border bg-wanas-surface px-5 text-sm font-bold text-wanas-text-primary"
          >
            إرسال رسالة أخرى
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 rounded-[24px] border border-wanas-border bg-wanas-surface p-6 shadow-sm sm:p-8"
        >
          {errorMessage ? (
            <div role="alert" className="rounded-2xl border border-wanas-error-border bg-wanas-error-surface px-4 py-3 text-sm text-wanas-error">
              {errorMessage}
            </div>
          ) : null}

          <PublicField
            id="contact-name"
            label="الاسم"
            value={name}
            onChange={setName}
            placeholder="اسمك"
            icon={<UserIcon />}
            disabled={isSubmitting}
          />
          <PublicField
            id="contact-email"
            label="البريد الإلكتروني"
            value={email}
            onChange={setEmail}
            placeholder="example@email.com"
            icon={<MailIcon />}
            type="email"
            inputMode="email"
            disabled={isSubmitting}
          />
          <label htmlFor="contact-reason" className="block space-y-2">
            <span className="text-sm font-semibold text-wanas-text-primary">سبب التواصل</span>
            <select
              id="contact-reason"
              value={reason}
              disabled={isSubmitting}
              onChange={(e) => setReason(e.target.value)}
              className="h-12 w-full rounded-2xl border border-wanas-border bg-wanas-surface-soft px-4 text-sm text-wanas-text-primary outline-none focus:border-wanas-accent focus:ring-2 focus:ring-wanas-accent/20 disabled:opacity-60"
            >
              <option value="">اختر السبب</option>
              {reasons.map((r) => (
                <option key={r.title} value={r.title}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="contact-message" className="block space-y-2">
            <span className="text-sm font-semibold text-wanas-text-primary">الرسالة</span>
            <textarea
              id="contact-message"
              value={message}
              disabled={isSubmitting}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="اكتب رسالتك هنا..."
              className="w-full rounded-2xl border border-wanas-border bg-wanas-surface-soft px-4 py-3 text-sm text-wanas-text-primary outline-none focus:border-wanas-accent focus:ring-2 focus:ring-wanas-accent/20 disabled:opacity-60"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'inline-flex h-12 w-full items-center justify-center rounded-2xl bg-wanas-accent text-sm font-bold text-white shadow-sm hover:bg-wanas-accent-hover',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {isSubmitting ? 'جاري الإرسال...' : 'إرسال الرسالة'}
          </button>
        </form>
      )}
    </main>
  );
}
