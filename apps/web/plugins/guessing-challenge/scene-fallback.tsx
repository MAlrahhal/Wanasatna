'use client';

import { Component, type ReactNode } from 'react';
import { FirstPersonGameScene } from './first-person-game-scene';
import type { GuessingChallengeSceneProps } from './scene-props';

export function CssGameplayFallback(props: GuessingChallengeSceneProps) {
  return (
    <div data-testid="gc-css-fallback-scene">
      <FirstPersonGameScene {...props} />
    </div>
  );
}

type SceneFallbackBoundaryProps = {
  fallback: ReactNode;
  children: ReactNode;
};

type SceneFallbackBoundaryState = { hasError: boolean };

/** Catches Real3D import throws and runtime scene exceptions; stays on CSS until remount. */
export class SceneFallbackBoundary extends Component<
  SceneFallbackBoundaryProps,
  SceneFallbackBoundaryState
> {
  state: SceneFallbackBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SceneFallbackBoundaryState {
    return { hasError: true };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
