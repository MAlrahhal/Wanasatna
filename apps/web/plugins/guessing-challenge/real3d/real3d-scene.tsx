'use client';

import type { GuessingChallengeSceneProps } from '../scene-props';
import { CssGameplayFallback, SceneFallbackBoundary } from '../scene-fallback';
import { Real3DSceneInner } from './real3d-scene-inner';

/** Client-only Real3D entry with error boundary → CSS fallback. */
export function Real3DScene(props: GuessingChallengeSceneProps) {
  return (
    <SceneFallbackBoundary fallback={<CssGameplayFallback {...props} />}>
      <Real3DSceneInner {...props} />
    </SceneFallbackBoundary>
  );
}
