'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ADSTERRA_NATIVE_ADS_ENABLED,
  ADSTERRA_NATIVE_UNITS,
  type AdsterraNativeUnitId,
} from '@/lib/ads/adsterra-native';
import { enqueueAdsterraNative } from '@/lib/ads/adsterra-native-loader';
import { cn } from '@/lib/utils';

type NativeAdPlacementProps = {
  unit: AdsterraNativeUnitId;
  className?: string;
  fallback?: ReactNode;
  fallbackAfterMs?: number;
};

export function NativeAdPlacement({
  unit,
  className,
  fallback,
  fallbackAfterMs,
}: NativeAdPlacementProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failedUnit, setFailedUnit] = useState<AdsterraNativeUnitId | null>(null);
  const config = ADSTERRA_NATIVE_UNITS[unit];

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !ADSTERRA_NATIVE_ADS_ENABLED) {
      return undefined;
    }

    let active = true;
    setFailedUnit(null);
    const handle = enqueueAdsterraNative(host, config);
    const fallbackTimerId =
      fallbackAfterMs === undefined
        ? undefined
        : window.setTimeout(() => {
            if (!active) {
              return;
            }

            handle.cancel();
            setFailedUnit(unit);
          }, fallbackAfterMs);

    void handle.completion.then((outcome) => {
      if (fallbackTimerId !== undefined) {
        window.clearTimeout(fallbackTimerId);
      }
      if (active && (outcome === 'error' || outcome === 'timeout' || outcome === 'duplicate')) {
        setFailedUnit(unit);
      }
    });

    return () => {
      active = false;
      if (fallbackTimerId !== undefined) {
        window.clearTimeout(fallbackTimerId);
      }
      handle.cancel();
    };
  }, [config, fallbackAfterMs, unit]);

  if (!ADSTERRA_NATIVE_ADS_ENABLED || failedUnit === unit) {
    return fallback;
  }

  return (
    <aside
      className={cn('w-full min-w-0 overflow-hidden', className)}
      aria-hidden="true"
      data-ad-provider="adsterra-native"
      data-ad-placement={unit}
    >
      <div ref={hostRef} className="w-full min-w-0 overflow-hidden" data-native-ad-host={unit} />
    </aside>
  );
}
