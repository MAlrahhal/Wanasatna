'use client';

import { useEffect, useState } from 'react';
import {
  isAdPlacementEnabled,
  isAdPlacementVisibleAtViewport,
  selectResponsiveAdsterraZone,
  type AdPlacementId,
  type AdPlacementViewport,
} from '@/lib/ads/adsterra';
import { cn } from '@/lib/utils';
import { AdsterraBanner } from './adsterra-banner';

type AdPlacementProps = {
  placement: AdPlacementId;
  viewport?: AdPlacementViewport;
  className?: string;
};

function currentViewportWidth(): number {
  return typeof window === 'undefined' ? 0 : window.innerWidth;
}

export function AdPlacement({ placement, viewport = 'any', className }: AdPlacementProps) {
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(currentViewportWidth());
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  if (
    !isAdPlacementEnabled(placement) ||
    !isAdPlacementVisibleAtViewport(viewportWidth, viewport)
  ) {
    return null;
  }

  const zone = selectResponsiveAdsterraZone(viewportWidth);
  if (!zone) {
    return null;
  }

  return (
    <div
      className={cn(
        'relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden',
        className,
      )}
      data-ad-placement-container={placement}
    >
      <AdsterraBanner zone={zone} placement={placement} />
    </div>
  );
}
