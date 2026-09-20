'use client';

import { useEffect, useRef, useState } from 'react';
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
};

export function NativeAdPlacement({ unit, className }: NativeAdPlacementProps) {
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
    void handle.completion.then((outcome) => {
      if (active && (outcome === 'error' || outcome === 'timeout' || outcome === 'duplicate')) {
        setFailedUnit(unit);
      }
    });

    return () => {
      active = false;
      handle.cancel();
    };
  }, [config, unit]);

  if (!ADSTERRA_NATIVE_ADS_ENABLED || failedUnit === unit) {
    return null;
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
