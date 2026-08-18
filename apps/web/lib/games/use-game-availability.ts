'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  defaultPlayableAvailability,
  fetchPlayableGameAvailability,
  type PlayableAvailabilityMap,
} from '@/lib/games/availability';

export function usePlayableGameAvailability() {
  const [enabledById, setEnabledById] = useState<PlayableAvailabilityMap>(defaultPlayableAvailability);

  const refresh = useCallback(async () => {
    const next = await fetchPlayableGameAvailability();
    setEnabledById(next);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.hidden) {
        return;
      }
      void refresh();
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const isGameEnabled = useCallback(
    (gameId: string) => enabledById[gameId] !== false,
    [enabledById],
  );

  return { enabledById, isGameEnabled, refresh };
}
