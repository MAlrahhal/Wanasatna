'use client';

import { useEffect } from 'react';

export function useMobileOverlayScrollLock(open: boolean, mediaQuery: string): void {
  useEffect(() => {
    if (!open) {
      return;
    }

    const query = window.matchMedia(mediaQuery);
    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    let locked = false;

    const syncLock = () => {
      if (query.matches && !locked) {
        root.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        locked = true;
        return;
      }

      if (!query.matches && locked) {
        root.style.overflow = previousRootOverflow;
        body.style.overflow = previousBodyOverflow;
        locked = false;
      }
    };

    syncLock();
    query.addEventListener('change', syncLock);

    return () => {
      query.removeEventListener('change', syncLock);
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [mediaQuery, open]);
}
