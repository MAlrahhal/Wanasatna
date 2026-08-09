'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { FirstPersonGameScene } from './first-person-game-scene';
import { detectWebGLSupport, type GuessingChallengeSceneProps } from './scene-props';

const Real3DSceneLazy = dynamic(
  () => import('./real3d/real3d-scene').then((mod) => mod.Real3DScene),
  {
    ssr: false,
    loading: () => (
      <div
        data-testid="gc-real3d-loading"
        className="flex min-h-[280px] items-center justify-center rounded-[1.5rem] border border-border bg-card text-sm text-muted-foreground"
      >
        جاري تحميل المشهد ثلاثي الأبعاد...
      </div>
    ),
  },
);

/**
 * Chooses Real3D (lazy) when WebGL is available; otherwise CSS first-person fallback.
 * Never eagerly pulls Three.js into lobby/home bundles.
 */
export function GameplayScene(props: GuessingChallengeSceneProps) {
  const [mode, setMode] = useState<'pending' | 'real3d' | 'fallback'>('pending');

  useEffect(() => {
    setMode(detectWebGLSupport() ? 'real3d' : 'fallback');
  }, []);

  if (mode === 'pending') {
    return (
      <div
        data-testid="gc-scene-pending"
        className="flex min-h-[280px] items-center justify-center rounded-[1.5rem] border border-border bg-card text-sm text-muted-foreground"
      >
        جاري تجهيز المشهد...
      </div>
    );
  }

  if (mode === 'fallback') {
    return (
      <div data-testid="gc-css-fallback-scene">
        <FirstPersonGameScene {...props} />
      </div>
    );
  }

  return <Real3DSceneLazy {...props} />;
}
