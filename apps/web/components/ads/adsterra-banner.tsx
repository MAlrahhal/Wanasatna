'use client';

import { useEffect, useRef } from 'react';
import { type AdsterraBannerZone } from '@/lib/ads/adsterra';
import { enqueueAdsterraBanner } from '@/lib/ads/adsterra-loader';
import { cn } from '@/lib/utils';

type AdsterraBannerProps = {
  zone: AdsterraBannerZone;
  placement: string;
  className?: string;
};

export function AdsterraBanner({ zone, placement, className }: AdsterraBannerProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof window === 'undefined') {
      return undefined;
    }

    return enqueueAdsterraBanner(host, zone);
  }, [zone]);

  return (
    <aside
      className={cn('flex w-full max-w-full justify-center overflow-hidden', className)}
      aria-hidden="true"
      data-ad-provider="adsterra"
      data-ad-placement={placement}
      data-ad-width={zone.width}
      data-ad-height={zone.height}
    >
      <div
        ref={hostRef}
        dir="ltr"
        className="relative shrink-0 overflow-hidden"
        style={{ width: zone.width, height: zone.height }}
      />
    </aside>
  );
}
