'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { GuessingChallengeSceneProps, GuessingChallengeTeamSeat } from '../scene-props';
import { resolveIdentityCardText } from '../identity-display';
import { FirstPersonHands } from './first-person-hands';
import { IdentityCardMesh } from './identity-card-mesh';
import { LookControls, type LookControlsHandle } from './look-controls';
import { BeanCharacter } from './bean-character';
import { LoungeRoom, OrangeArmchair } from './lounge-room';
import { LowPolyOpponent } from './low-poly-opponent';
import { Html } from '@react-three/drei';
import './real3d-scene.css';

const YAW_1V1 = (38 * Math.PI) / 180;
const YAW_2V2 = (45 * Math.PI) / 180;
const PITCH_LIMIT = (18 * Math.PI) / 180;

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

function opponentTint(
  selfTeam: 'blue' | 'red' | undefined,
): 'blue' | 'red' | 'opponent' {
  if (selfTeam === 'blue') return 'red';
  if (selfTeam === 'red') return 'blue';
  return 'opponent';
}

function TeammateSeat({
  teammate,
  selfTeam,
  selfSeat,
  reduceMotion,
}: {
  teammate: GuessingChallengeTeamSeat;
  selfTeam?: 'blue' | 'red';
  selfSeat: 0 | 1;
  reduceMotion: boolean;
}) {
  // selfSeat 0 → teammate on +x (right of camera); selfSeat 1 → -x
  const x = selfSeat === 0 ? 1.15 : -1.15;
  const tint = selfTeam === 'red' ? 'red' : 'blue';

  return (
    <group position={[x, 0, 0.35]} rotation={[0, selfSeat === 0 ? -0.55 : 0.55, 0]}>
      <OrangeArmchair />
      <group position={[0, 0.42, 0.08]}>
        <BeanCharacter
          teamTint={tint}
          lookYaw={teammate.lookYaw ?? 0}
          lookPitch={teammate.lookPitch ?? 0}
          reduceMotion={reduceMotion}
        />
      </group>
      <Html
        center
        position={[0, -0.05, 0.35]}
        distanceFactor={6.5}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        zIndexRange={[8, 0]}
      >
        <div
          data-testid="gc-teammate-character"
          dir="rtl"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            color: '#f8fafc',
            fontWeight: 700,
            fontSize: '0.78rem',
            textShadow: '0 1px 4px rgba(0,0,0,0.55)',
          }}
        >
          <span
            aria-hidden
            style={{
              width: '0.55rem',
              height: '0.55rem',
              borderRadius: '999px',
              background: tint === 'blue' ? '#38bdf8' : '#fb7185',
              flexShrink: 0,
            }}
          />
          <span>{teammate.name}</span>
        </div>
      </Html>
    </group>
  );
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
  const matchMode = props.matchMode ?? '1v1';
  const is2v2 = matchMode === '2v2';
  const oppTint = opponentTint(props.selfTeam);
  const oppDot = props.selfTeam === 'blue' ? 'red' : props.selfTeam === 'red' ? 'blue' : 'opponent';

  const opponents = useMemo(() => {
    if (props.opponents && props.opponents.length > 0) {
      return props.opponents;
    }
    return [
      {
        playerId: 'opponent',
        name: props.opponentName,
        seat: 0 as const,
      },
    ];
  }, [props.opponents, props.opponentName]);

  const yawLimit = is2v2 ? YAW_2V2 : YAW_1V1;

  return (
    <>
      <color attach="background" args={['#2e1065']} />
      <fog attach="fog" args={['#3b0764', 8, 18]} />
      <ambientLight intensity={0.45} color="#fce7f3" />
      <directionalLight
        castShadow
        intensity={0.95}
        position={[2.2, 4.8, 1.5]}
        color="#ffedd5"
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight intensity={0.5} position={[0, 2.4, -1]} color="#fdba74" />
      <pointLight intensity={0.35} position={[0, 2.6, -3.8]} color="#f472b6" />

      <LookControls
        enabled
        reduceMotion={reduceMotion}
        yawLimit={yawLimit}
        pitchLimit={PITCH_LIMIT}
        onReady={onLookReady}
        onLookChange={props.onLookChange}
      />

      <LoungeRoom />

      <FirstPersonHands
        selfName={props.selfName}
        selfHidden={props.selfHidden}
        selfIdentity={props.selfIdentity}
        revealed={revealed}
        selfHighlight={props.selfHighlight}
        reduceMotion={reduceMotion}
      />

      {/* Opponents */}
      {is2v2 && opponents.length >= 2 ? (
        <group>
          {/* Shared identity card between two opponents */}
          <group position={[0, 1.15, -2.35]} rotation={[-0.25, 0, 0]}>
            <IdentityCardMesh
              text={resolveIdentityCardText(props.opponentIdentity, false)}
              label={revealed ? 'كانوا' : 'هوية الخصوم'}
              highlight={props.opponentHighlight}
              flipKey={props.opponentIdentity?.value ?? ''}
              reduceMotion={reduceMotion}
              width={0.62}
              height={0.42}
              testId="gc-opponent-identity"
            />
          </group>
          <LowPolyOpponent
            name={opponents[0].name}
            holdOwnCard={false}
            reachToward={[0.35, 0.45, 0.55]}
            teamTint={oppTint}
            teamDot={oppDot}
            lookYaw={opponents[0].lookYaw ?? 0}
            lookPitch={opponents[0].lookPitch ?? 0}
            highlight={props.opponentHighlight}
            reduceMotion={reduceMotion}
            position={[-0.75, 0, -2.45]}
            rotationY={0.28}
            testId="gc-opponent-character-0"
          />
          <LowPolyOpponent
            name={opponents[1].name}
            holdOwnCard={false}
            reachToward={[-0.35, 0.45, 0.55]}
            teamTint={oppTint}
            teamDot={oppDot}
            lookYaw={opponents[1].lookYaw ?? 0}
            lookPitch={opponents[1].lookPitch ?? 0}
            highlight={props.opponentHighlight}
            reduceMotion={reduceMotion}
            position={[0.75, 0, -2.45]}
            rotationY={-0.28}
            testId="gc-opponent-character-1"
          />
        </group>
      ) : (
        <LowPolyOpponent
          name={opponents[0]?.name ?? props.opponentName}
          identity={props.opponentIdentity}
          holdOwnCard
          teamTint={oppTint}
          teamDot={oppDot}
          lookYaw={opponents[0]?.lookYaw ?? 0}
          lookPitch={opponents[0]?.lookPitch ?? 0}
          highlight={props.opponentHighlight}
          labelPrefix={revealed ? `${opponents[0]?.name ?? props.opponentName} كان` : 'هوية الخصم'}
          reduceMotion={reduceMotion}
          position={[0, 0, -2.55]}
        />
      )}

      {/* Teammate (2v2) */}
      {is2v2 && props.teammate ? (
        <TeammateSeat
          teammate={props.teammate}
          selfTeam={props.selfTeam}
          selfSeat={props.selfSeat ?? 0}
          reduceMotion={reduceMotion}
        />
      ) : null}
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
      data-match-mode={props.matchMode ?? '1v1'}
      style={{ position: 'relative', width: '100%' }}
    >
      <div className="gc-real3d-canvas-shell">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [0, 1.35, 1.65], fov: 55, near: 0.1, far: 40 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.setClearColor('#2e1065');
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
          className="rounded-lg border border-orange-400/35 bg-violet-950/70 px-3 py-1.5 text-xs font-semibold text-orange-100"
          data-testid="gc-recenter-camera"
        >
          إعادة توسيط النظر
        </button>
        {props.mode === 'playing' && props.turnTitle ? (
          <div
            className="rounded-lg border border-orange-400/25 bg-violet-950/55 px-3 py-1.5 text-right"
            data-testid="gc-turn-indicator"
            dir="rtl"
          >
            <p className="text-xs font-semibold text-orange-100">{props.turnTitle}</p>
            {props.turnInstruction ? (
              <p className="text-[0.65rem] text-violet-100/80">{props.turnInstruction}</p>
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
