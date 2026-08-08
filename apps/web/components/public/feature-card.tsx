import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type FeatureCardProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  accent?: 'blue' | 'cyan' | 'purple' | 'orange' | 'green';
  className?: string;
};

const accentStyles = {
  blue: 'bg-wanas-panel-soft border-wanas-border text-wanas-primary-dark',
  cyan: 'bg-wanas-game-teal-surface border-wanas-game-teal-border-light text-wanas-game-teal-darker',
  purple: 'bg-wanas-accent-soft border-wanas-border text-wanas-primary',
  orange: 'bg-wanas-warning-surface-light border-wanas-warning-border text-wanas-warning-text',
  green: 'bg-wanas-game-green-surface border-wanas-success-border-light text-wanas-success-text',
};

export function FeatureCard({
  title,
  description,
  icon,
  accent = 'blue',
  className,
}: FeatureCardProps) {
  return (
    <article
      className={cn(
        'wanas-interactive-card p-4',
        accentStyles[accent],
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 flex size-10 items-center justify-center rounded-[var(--wanas-radius-control)] border border-current/20 bg-wanas-surface shadow-sm">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-bold text-wanas-text-primary">{title}</h3>
      {description ? <p className="mt-1.5 text-sm leading-6 text-wanas-text-muted">{description}</p> : null}
    </article>
  );
}
