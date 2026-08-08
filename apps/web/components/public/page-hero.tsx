import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageHeroProps = {
  title: string;
  description?: string;
  children?: ReactNode;
  variant?: 'default' | 'premium' | 'compact';
  className?: string;
};

export function PageHero({
  title,
  description,
  children,
  variant = 'default',
  className,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden border-y border-wanas-border px-5 py-8 shadow-[var(--wanas-shadow-panel)] sm:px-8 sm:py-10',
        variant === 'premium'
          ? 'bg-wanas-background-strong'
          : 'bg-wanas-hero',
        variant === 'compact' && 'py-6 sm:py-8',
        className,
      )}
    >
      <div className="relative mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-wanas-text-primary sm:text-4xl lg:text-5xl">{title}</h1>
        {description ? (
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-wanas-text-secondary sm:text-base">{description}</p>
        ) : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  );
}
