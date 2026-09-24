import Image from 'next/image';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { cn } from '@/lib/utils';

export const WANASATNA_LOGO_SRC = '/brand/wanasatna-logo.png';

type PublicBrandLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClassName = {
  sm: 'h-11 w-auto max-h-11 lg:h-14 lg:max-h-14',
  md: 'h-16 w-auto max-h-16',
  lg: 'h-auto w-full max-w-[30rem]',
};

export function PublicBrandLogo({ size = 'md', className }: PublicBrandLogoProps) {
  return (
    <Image
      src={WANASATNA_LOGO_SRC}
      alt={BRAND_NAME_AR}
      width={1391}
      height={1131}
      priority={size === 'sm' || size === 'lg'}
      className={cn('object-contain', sizeClassName[size], className)}
    />
  );
}
