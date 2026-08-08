import { BRAND_NAME_AR } from '@/lib/public/brand';
import { cn } from '@/lib/utils';

type PublicBrandLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  tone?: 'default' | 'on-dark';
  className?: string;
};

const sizes = {
  sm: { mark: 'size-9 text-sm rounded-[14px]', name: 'text-base' },
  md: { mark: 'size-11 text-base rounded-2xl', name: 'text-xl' },
  lg: { mark: 'size-16 text-2xl rounded-[1.25rem]', name: 'text-2xl' },
};

export function PublicBrandLogo({
  size = 'md',
  showName = true,
  tone = 'default',
  className,
}: PublicBrandLogoProps) {
  const s = sizes[size];
  const onDark = tone === 'on-dark';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'flex items-center justify-center font-bold shadow-sm',
          onDark
            ? 'border border-white/30 bg-white text-wanas-navbar'
            : 'bg-wanas-primary text-[color:var(--wanas-background)]',
          s.mark,
        )}
      >
        و
      </div>
      {showName ? (
        <span
          className={cn(
            'font-bold',
            onDark ? 'text-wanas-text-on-brand' : 'text-wanas-text-primary',
            s.name,
          )}
        >
          {BRAND_NAME_AR}
        </span>
      ) : null}
    </div>
  );
}
