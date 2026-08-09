'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { GuessingChallengeSceneProps } from '../scene-props';
import { FirstPersonGameScene } from '../first-person-game-scene';
import { Real3DSceneInner } from './real3d-scene-inner';

type BoundaryState = { hasError: boolean };

class Real3DErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  BoundaryState
> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[guessing-challenge] Real3D scene failed', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/** Client-only Real3D entry with error boundary → CSS fallback. */
export function Real3DScene(props: GuessingChallengeSceneProps) {
  return (
    <Real3DErrorBoundary
      fallback={
        <div data-testid="gc-css-fallback-scene" data-reason="error-boundary">
          <FirstPersonGameScene {...props} />
        </div>
      }
    >
      <Real3DSceneInner {...props} />
    </Real3DErrorBoundary>
  );
}
