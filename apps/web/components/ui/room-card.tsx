import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type RoomCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function RoomCard({ title, description, icon, children, className }: RoomCardProps) {
  return (
    <article className={cn('wanas-panel border-t-2 border-t-wanas-accent p-5', className)}>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-[var(--wanas-radius-control)] bg-wanas-accent font-bold text-[color:var(--wanas-background)] shadow-[0_3px_0_var(--wanas-brand-navy)]">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-bold text-wanas-text-primary">{title}</h2>
          <p className="text-sm text-wanas-text-muted">{description}</p>
        </div>
      </div>
      {children}
    </article>
  );
}
