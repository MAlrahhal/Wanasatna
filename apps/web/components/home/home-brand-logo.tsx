import Image from 'next/image';
import { cn } from '@/lib/utils';

type HomeBrandLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
};

const sizeClasses = {
  sm: 'h-11 w-auto lg:h-14',
  md: 'h-16 w-auto',
  lg: 'h-auto w-full max-w-[30rem]',
} as const;

export function HomeBrandLogo({ size = 'md', className }: HomeBrandLogoProps) {
  return (
    <Image
      src="/brand/wanasatna-logo.png"
      alt="وناسَتنا"
      width={1254}
      height={1254}
      priority={size === 'sm' || size === 'lg'}
      className={cn('object-contain', sizeClasses[size], className)}
    />
  );
}
