'use client';

import { Component, type ComponentType, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import type { GamePluginScreenProps } from '@wanasatna/shared';
import { GameSystemError, GameSystemLoading } from '@/components/room/room-system-state';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';
import { reloadStaleGameChunk } from '@/lib/game-plugins/reload-stale-game-chunk';

export type LazyGameScreen = ComponentType<GamePluginScreenProps>;

function GameScreenChunkLoading() {
  return <GameSystemLoading />;
}

/** One GameScreen chunk per game. Metadata stays in the plugin entry. */
export function lazyGameScreen(loader: () => Promise<LazyGameScreen>): LazyGameScreen {
  return dynamic(loader, {
    ssr: false,
    loading: GameScreenChunkLoading,
  });
}

export { reloadStaleGameChunk };

type ChunkErrorBoundaryState = { hasError: boolean };

export class GameScreenChunkErrorBoundary extends Component<
  { children: ReactNode },
  ChunkErrorBoundaryState
> {
  state: ChunkErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ChunkErrorBoundaryState {
    return { hasError: true };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <GameSystemError message={SYSTEM_COPY.gameLoadFailed} onRetry={reloadStaleGameChunk} />
      );
    }
    return this.props.children;
  }
}
