import Link from 'next/link';
import { cn } from '@/lib/utils';

export type SeoBreadcrumbItem = {
  href?: string;
  label: string;
};

type SeoBreadcrumbProps = {
  items: SeoBreadcrumbItem[];
  className?: string;
};

export function SeoBreadcrumb({ items, className }: SeoBreadcrumbProps) {
  return (
    <nav aria-label="مسار الصفحة" className={cn('mb-6 text-sm font-semibold', className)}>
      <ol className="text-wanas-text-muted flex flex-wrap items-center gap-x-1 gap-y-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? (
                <span aria-hidden className="text-wanas-text-subtle px-0.5">
                  /
                </span>
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-wanas-primary-dark hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? 'text-wanas-text-primary' : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
