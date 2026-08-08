'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { GameExperienceMeta } from '@/lib/game/shell-types';

type GameExperienceContextValue = {
  shellActive: boolean;
  meta: GameExperienceMeta | null;
  setMeta: (meta: GameExperienceMeta | null) => void;
};

const GameExperienceContext = createContext<GameExperienceContextValue | null>(null);

export function GameExperienceProvider({
  children,
  shellActive = false,
}: {
  children: ReactNode;
  shellActive?: boolean;
}) {
  const [meta, setMetaState] = useState<GameExperienceMeta | null>(null);

  const setMeta = useCallback((next: GameExperienceMeta | null) => {
    setMetaState(next);
  }, []);

  const value = useMemo(
    () => ({ shellActive, meta, setMeta }),
    [shellActive, meta, setMeta],
  );

  return (
    <GameExperienceContext.Provider value={value}>{children}</GameExperienceContext.Provider>
  );
}

export function useGameExperienceShellActive(): boolean {
  return useContext(GameExperienceContext)?.shellActive ?? false;
}

export function useGameExperienceMeta(): GameExperienceMeta | null {
  return useContext(GameExperienceContext)?.meta ?? null;
}

export function useSetGameExperienceMeta(): (meta: GameExperienceMeta | null) => void {
  const ctx = useContext(GameExperienceContext);
  return ctx?.setMeta ?? (() => undefined);
}
