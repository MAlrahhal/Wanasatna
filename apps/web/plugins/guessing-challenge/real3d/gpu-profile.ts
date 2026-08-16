'use client';

import { useEffect, useState } from 'react';

/** Phones in the 320–430px range — desktop/tablet quality stays unchanged. */
export const GC_COMPACT_GPU_MQ = '(max-width: 430px)';

export function readCompactGcGpu(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(GC_COMPACT_GPU_MQ).matches;
}

export function useCompactGcGpu(): boolean {
  const [compact, setCompact] = useState(readCompactGcGpu);

  useEffect(() => {
    const media = window.matchMedia(GC_COMPACT_GPU_MQ);
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return compact;
}

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(
    () => (typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'),
  );

  useEffect(() => {
    const sync = () => setVisible(document.visibilityState !== 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return visible;
}
