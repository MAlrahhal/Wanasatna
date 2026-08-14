import type { ReactNode } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export type SystemStatusTone =
  | 'loading'
  | 'connecting'
  | 'reconnecting'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'disconnected';

type SystemStatusProps = {
  tone?: SystemStatusTone;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

const toneClasses: Record<SystemStatusTone, string> = {
  loading: 'border-wanas-accent/35 bg-wanas-surface',
  connecting: 'border-wanas-accent/35 bg-wanas-surface',
  reconnecting: 'border-wanas-warning-border bg-wanas-warning-surface',
  info: 'border-wanas-border bg-wanas-surface',
  success: 'border-wanas-success-border bg-wanas-success-surface',
  warning: 'border-wanas-warning-border bg-wanas-warning-surface',
  error: 'border-wanas-error-border bg-wanas-error-surface',
  disconnected: 'border-wanas-error-border bg-wanas-error-surface',
};

const titleClasses: Record<SystemStatusTone, string> = {
  loading: 'text-wanas-text-primary',
  connecting: 'text-wanas-text-primary',
  reconnecting: 'text-wanas-warning-dark',
  info: 'text-wanas-text-primary',
  success: 'text-wanas-success-dark',
  warning: 'text-wanas-warning-dark',
  error: 'text-wanas-error',
  disconnected: 'text-wanas-error',
};

export function SystemStatus({
  tone = 'info',
  title,
  description,
  action,
  className,
}: SystemStatusProps) {
  const showSpinner = tone === 'loading' || tone === 'connecting' || tone === 'reconnecting';

  return (
    <div
      role={tone === 'error' || tone === 'disconnected' ? 'alert' : 'status'}
      className={cn(
        'rounded-[var(--wanas-radius-card)] border px-4 py-3 text-sm leading-6',
        toneClasses[tone],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {showSpinner ? <Spinner size="sm" className="mt-0.5 shrink-0" /> : null}
        <div className="min-w-0 flex-1">
          <p className={cn('font-semibold', titleClasses[tone])}>{title}</p>
          {description ? <p className="mt-1 text-wanas-text-muted">{description}</p> : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
