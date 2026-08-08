import { cn } from '@/lib/utils';

type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClasses = {
  sm: 'size-4 border-2',
  md: 'size-8 border-[3px]',
  lg: 'size-10 border-[3px]',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="جاري التحميل"
      className={cn(
        'inline-block animate-spin rounded-full border-wanas-primary-muted border-t-wanas-primary',
        sizeClasses[size],
        className,
      )}
    />
  );
}
