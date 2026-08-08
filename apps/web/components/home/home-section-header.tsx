import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type HomeSectionHeaderProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  align?: 'start' | 'center';
  className?: string;
};

export function HomeSectionHeader({
  title,
  description,
  icon,
  align = 'start',
  className,
}: HomeSectionHeaderProps) {
  return (
    <div
      className={cn(
        'space-y-3',
        align === 'center' && 'mx-auto max-w-2xl text-center',
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            'flex size-10 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]',
            align === 'center' && 'mx-auto',
          )}
        >
          {icon}
        </div>
      ) : null}
      <h2 className="text-2xl font-bold text-[#0F172A] sm:text-3xl">{title}</h2>
      {description ? (
        <p className="text-sm leading-7 text-[#64748B] sm:text-base">{description}</p>
      ) : null}
    </div>
  );
}
