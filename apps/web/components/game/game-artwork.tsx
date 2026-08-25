import Image from 'next/image';
import { cn } from '@/lib/utils';

type GameArtworkProps = {
  src: string | null;
  alt?: string;
  className?: string;
  sizes?: string;
};

export function GameArtwork({ src, alt = '', className, sizes = '80px' }: GameArtworkProps) {
  if (!src) {
    return null;
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={1254}
      height={1254}
      sizes={sizes}
      className={cn('h-full w-full object-contain', className)}
    />
  );
}
