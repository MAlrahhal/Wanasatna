'use client';

import { useEffect, useRef, useState } from 'react';
import {
  selectFittingStaticZone,
  type AdsterraBannerZone,
  type StaticAdPlacementId,
} from '@/lib/ads/adsterra';
import { cn } from '@/lib/utils';
import { AdsterraBanner } from './adsterra-banner';

type AdPlacementProps = {
  placement: StaticAdPlacementId;
  className?: string;
};

export function AdPlacement({ placement, className }: AdPlacementProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zone, setZone] = useState<AdsterraBannerZone | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const updateZone = () => {
      const nextZone = selectFittingStaticZone(
        placement,
        container.getBoundingClientRect().width,
        window.innerWidth,
      );
      setZone((currentZone) => (currentZone?.id === nextZone?.id ? currentZone : nextZone));
    };

    updateZone();
    window.addEventListener('resize', updateZone);
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => updateZone());
    observer?.observe(container);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateZone);
    };
  }, [placement]);

  return (
    <div
      ref={containerRef}
      className={cn('w-full min-w-0 overflow-hidden', className)}
      data-ad-placement-container={placement}
    >
      {zone ? <AdsterraBanner zone={zone} placement={placement} /> : null}
    </div>
  );
}
