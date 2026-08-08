import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PlaygroundSectionProps = {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function PlaygroundSection({ id, title, description, children, className }: PlaygroundSectionProps) {
  return (
    <section id={id} className={cn('scroll-mt-24 rounded-[24px] border border-wanas-border bg-wanas-surface p-6 shadow-sm', className)}>
      <h2 className="text-xl font-bold text-wanas-text-primary">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-7 text-wanas-text-muted">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

type PlaygroundSubsectionProps = {
  title: string;
  children: ReactNode;
};

export function PlaygroundSubsection({ title, children }: PlaygroundSubsectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-wanas-text-secondary">{title}</h3>
      {children}
    </div>
  );
}
