'use client';

import { useEffect, useRef } from 'react';
import {
  ADSTERRA_BANNER_300x250,
  toAdsterraAtOptions,
  type AdsterraAtOptions,
  type AdsterraBannerZone,
} from '@/lib/ads/adsterra';
import { cn } from '@/lib/utils';

type AdsterraWindow = Window & {
  atOptions?: AdsterraAtOptions;
};

type AdsterraBannerProps = {
  zone?: AdsterraBannerZone;
  className?: string;
};

function clearNode(node: HTMLElement): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

export function AdsterraBanner({
  zone = ADSTERRA_BANNER_300x250,
  className,
}: AdsterraBannerProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof window === 'undefined') {
      return undefined;
    }

    let cancelled = false;

    try {
      clearNode(host);
      const adWindow = window as AdsterraWindow;
      adWindow.atOptions = toAdsterraAtOptions(zone);

      const script = document.createElement('script');
      script.src = zone.invokeSrc;
      script.async = false;
      script.dataset.adsterraKey = zone.key;
      script.onerror = () => {
        if (!cancelled) {
          clearNode(host);
        }
      };
      host.appendChild(script);
    } catch {
      clearNode(host);
    }

    return () => {
      cancelled = true;
      clearNode(host);
      const adWindow = window as AdsterraWindow;
      if (adWindow.atOptions?.key === zone.key) {
        delete adWindow.atOptions;
      }
    };
  }, [zone]);

  return (
    <aside
      className={cn('flex w-full justify-center overflow-x-auto', className)}
      aria-hidden="true"
      data-ad-provider="adsterra"
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
