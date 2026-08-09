'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useState } from 'react';
import type { GuessingChallengeSceneProps } from '../scene-props';
import { LookControls, type LookControlsHandle } from './look-controls';
import { LowPolyOpponent } from './low-poly-opponent';
import { TableAndCards } from './table-and-cards';
import './real3d-scene.css';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  return reduced;
}

function SceneContent({
  props,
  reduceMotion,
  onLookReady,
}: {
  props: GuessingChallengeSceneProps;
  reduceMotion: boolean;
  onLookReady: (handle: LookControlsHandle) => void;
}) {
  const revealed = props.mode === 'reveal';

  return (
    <>
      <color attach="background" args={['#070b16']} />
      <fog attach="fog" args={['#070b16', 6, 14]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        intensity={1.05}
        position={[2.5, 4.5, 2]}
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight intensity={0.45} position={[-1.5, 2.2, 0.5]} color="#22d3ee" />

      <LookControls enabled reduceMotion={reduceMotion} onReady={onLookReady} />

      <TableAndCards
        selfName={props.selfName}
        selfHidden={props.selfHidden}
        selfIdentity={props.selfIdentity}
        revealed={revealed}
        selfHighlight={props.selfHighlight}
        isMyTurn={props.isMyTurn}
        showSpecialCards={props.showSpecialCards !== false && !revealed}
        yellowAvailable={props.yellowAvailable}
        redAvailable={props.redAvailable}
        canUseYellow={props.canUseYellow}
        canUseRed={props.canUseRed}
        yellowDisabled={props.yellowDisabled}
        redDisabled={props.redDisabled}
        yellowQuestionsRemaining={props.yellowQuestionsRemaining}
        onUseYellow={props.onUseYellow}
        onUseRed={props.onUseRed}
        reduceMotion={reduceMotion}
      />

      <LowPolyOpponent
        name={props.opponentName}
        identity={props.opponentIdentity}
        highlight={props.opponentHighlight}
        labelPrefix={revealed ? `${props.opponentName} كان` : 'هوية الخصم'}
        reduceMotion={reduceMotion}
      />
    </>
  );
}

export function Real3DSceneInner(props: GuessingChallengeSceneProps) {
  const [look, setLook] = useState<LookControlsHandle | null>(null);
  const reduceMotion = usePrefersReducedMotion();
  const onLookReady = useCallback((handle: LookControlsHandle) => {
    setLook(handle);
  }, []);

  return (
    <div
      className={props.className}
      data-testid="gc-real3d-scene"
      data-mode={props.mode}
      style={{ position: 'relative', width: '100%' }}
    >
      <div className="gc-real3d-canvas-shell">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [0, 1.35, 1.55], fov: 55, near: 0.1, far: 40 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.setClearColor('#070b16');
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <Suspense fallback={null}>
            <SceneContent props={props} reduceMotion={reduceMotion} onLookReady={onLookReady} />
          </Suspense>
        </Canvas>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={() => look?.recenter()}
          className="rounded-lg border border-cyan-400/30 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-cyan-200"
          data-testid="gc-recenter-camera"
        >
          إعادة توسيط النظر
        </button>
        {props.mode === 'playing' && props.turnTitle ? (
          <div
            className="rounded-lg border border-cyan-400/25 bg-cyan-950/50 px-3 py-1.5 text-right"
            data-testid="gc-turn-indicator"
            dir="rtl"
          >
            <p className="text-xs font-semibold text-cyan-200">{props.turnTitle}</p>
            {props.turnInstruction ? (
              <p className="text-[0.65rem] text-slate-300">{props.turnInstruction}</p>
            ) : null}
            {props.yellowQuestionsRemaining != null ? (
              <p className="text-[0.65rem] font-semibold text-amber-200">
                🟨 المتبقي: {props.yellowQuestionsRemaining}
              </p>
            ) : null}
          </div>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
