import { cn } from '@/lib/utils';

type HomeBrandLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
};

const sizeClasses = {
  sm: { mark: 'size-9 text-sm rounded-xl', name: 'text-base' },
  md: { mark: 'size-11 text-sm rounded-xl', name: 'text-lg' },
  lg: { mark: 'size-[4.5rem] text-3xl rounded-[1.25rem]', name: 'text-4xl sm:text-5xl' },
} as const;

export function HomeBrandLogo({ size = 'md', showName = true, className }: HomeBrandLogoProps) {
  const sizes = sizeClasses[size];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'flex items-center justify-center bg-wanas-brand-navy font-bold text-white shadow-sm',
          sizes.mark,
        )}
      >
        و
      </div>
      {showName ? (
        <span className={cn('font-bold text-wanas-brand-navy', sizes.name)}>ونساتنا</span>
      ) : null}
    </div>
  );
}
