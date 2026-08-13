'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { GuessingChallengeSceneProps, GuessingChallengeTeamSeat } from '../scene-props';
import { FirstPersonGameScene } from '../first-person-game-scene';
import { resolveIdentityCardText } from '../identity-display';
import { FirstPersonHands } from './first-person-hands';
import { IdentityCardMesh } from './identity-card-mesh';
import { LookControls, type LookControlsHandle } from './look-controls';
import { BeanCharacter } from './bean-character';
import { LoungeRoom, OrangeArmchair } from './lounge-room';
import { LowPolyOpponent } from './low-poly-opponent';
import {
  CAMERA_FOV,
  cameraPositionForSeat,
  mapRemoteLookPitch,
  mapRemoteLookYaw,
  teammateSeatPosition,
} from './seat-layout';
import './real3d-scene.css';

const YAW_1V1 = (38 * Math.PI) / 180;
/** Wider yaw so local player can look sideways at teammate. */
const YAW_2V2 = (55 * Math.PI) / 180;
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

function CameraAnchor({ position }: { position: [number, number, number] }) {
  const { camera } = useThree();
  const [x, y, z] = position;
  useLayoutEffect(() => {
    camera.position.set(x, y, z);
  }, [camera, x, y, z]);
  return null;
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
  // Beside the local seat, mid-room — facing opponents (-Z).
  // selfSeat 0 → teammate on +x (right); selfSeat 1 → -x (left).
  // Looking sideways shows a side profile; body never faces the local camera.
  // no local third-person body
  const position = teammateSeatPosition(selfSeat);
  const tint = selfTeam === 'red' ? 'red' : 'blue';
  const teamDot = selfTeam === 'red' ? 'red' : 'blue';
  const lookYaw = mapRemoteLookYaw(teammate.lookYaw ?? 0, 'same-as-local');
  const lookPitch = mapRemoteLookPitch(teammate.lookPitch ?? 0);

  return (
    <group
      position={position}
      // Face opponents (-Z). Without π, the bean stares into the local camera.
      rotation={[0, Math.PI, 0]}
      userData={{ testId: 'gc-teammate-seat', facing: 'opponents' }}
    >
      <OrangeArmchair />
      <group position={[0, 0.4, 0.06]}>
        <BeanCharacter
          teamTint={tint}
          lookYaw={lookYaw}
          lookPitch={lookPitch}
          reduceMotion={reduceMotion}
          holdHand="both"
          nameBadge={
            <div
              data-testid="gc-teammate-character"
              data-name-anchor="above-head"
              dir="rtl"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.16rem 0.48rem',
                borderRadius: '999px',
                background: 'rgba(15,23,42,0.78)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#f8fafc',
                fontWeight: 700,
                fontSize: '0.68rem',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: '0.42rem',
                  height: '0.42rem',
                  borderRadius: '999px',
                  background: tint === 'blue' ? '#38bdf8' : '#fb7185',
                  flexShrink: 0,
                }}
              />
              <span>{teammate.name}</span>
              <span aria-hidden>{teamDot === 'blue' ? '🔵' : '🔴'}</span>
            </div>
          }
        />
      </group>
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
    const list =
      props.opponents && props.opponents.length > 0
        ? [...props.opponents]
        : [
            {
              playerId: 'opponent',
              name: props.opponentName,
              seat: 0 as const,
            },
          ];
    list.sort((left, right) => left.seat - right.seat);
    return list;
  }, [props.opponents, props.opponentName]);

  const yawLimit = is2v2 ? YAW_2V2 : YAW_1V1;
  const cameraPosition = cameraPositionForSeat(matchMode, props.selfSeat);

  return (
    <>
      <CameraAnchor position={cameraPosition} />
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
        <group userData={{ testId: 'gc-opponent-pair' }}>
          {/* Shared identity card between opponents — held by inner hands */}
          <group
            position={[0, 1.05, -1.95]}
            rotation={[-0.18, 0, 0]}
            userData={{ sharedCard: true }}
          >
            <IdentityCardMesh
              text={resolveIdentityCardText(props.opponentIdentity, false)}
              label={revealed ? 'كانوا' : undefined}
              highlight={props.opponentHighlight}
              flipKey={props.opponentIdentity?.value ?? ''}
              reduceMotion={reduceMotion}
              width={0.78}
              height={0.5}
              testId="gc-opponent-identity"
            />
          </group>
          {/* Left opponent — RIGHT (inner) hand toward shared card */}
          <LowPolyOpponent
            name={opponents[0].name}
            holdOwnCard={false}
            holdHand="right"
            reachToward={[0.42, 0.48, 0.42]}
            teamTint={oppTint}
            teamDot={oppDot}
            lookYaw={mapRemoteLookYaw(opponents[0].lookYaw ?? 0, 'toward-camera')}
            lookPitch={mapRemoteLookPitch(opponents[0].lookPitch ?? 0)}
            highlight={props.opponentHighlight}
            reduceMotion={reduceMotion}
            position={[-0.62, 0, -2.2]}
            rotationY={0.1}
            testId="gc-opponent-character-0"
          />
          {/* Right opponent — LEFT (inner) hand toward shared card */}
          <LowPolyOpponent
            name={opponents[1].name}
            holdOwnCard={false}
            holdHand="left"
            reachToward={[-0.42, 0.48, 0.42]}
            teamTint={oppTint}
            teamDot={oppDot}
            lookYaw={mapRemoteLookYaw(opponents[1].lookYaw ?? 0, 'toward-camera')}
            lookPitch={mapRemoteLookPitch(opponents[1].lookPitch ?? 0)}
            highlight={props.opponentHighlight}
            reduceMotion={reduceMotion}
            position={[0.62, 0, -2.2]}
            rotationY={-0.1}
            testId="gc-opponent-character-1"
          />
        </group>
      ) : (
        <LowPolyOpponent
          name={opponents[0]?.name ?? props.opponentName}
          identity={props.opponentIdentity}
          holdOwnCard
          holdHand="both"
          teamTint={oppTint}
          teamDot={oppDot}
          lookYaw={mapRemoteLookYaw(opponents[0]?.lookYaw ?? 0, 'toward-camera')}
          lookPitch={mapRemoteLookPitch(opponents[0]?.lookPitch ?? 0)}
          highlight={props.opponentHighlight}
          labelPrefix={revealed ? `${opponents[0]?.name ?? props.opponentName} كان` : undefined}
          reduceMotion={reduceMotion}
          position={[0, 0, -2.15]}
          rotationY={0}
        />
      )}

      {/* Teammate (2v2) — beside local seat, facing opponents; never under camera */}
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
  const [canvasFailed, setCanvasFailed] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const onLookReady = useCallback((handle: LookControlsHandle) => {
    setLook(handle);
  }, []);

  const revealed = props.mode === 'reveal';
  const opponentCardText = resolveIdentityCardText(props.opponentIdentity, false);
  const selfCardText = revealed
    ? resolveIdentityCardText(props.selfIdentity, false)
    : '';

  if (canvasFailed) {
    return (
      <div data-testid="gc-css-fallback-scene" data-reason="canvas-error">
        <FirstPersonGameScene {...props} />
      </div>
    );
  }

  return (
    <div
      className={props.className}
      data-testid="gc-real3d-scene"
      data-mode={props.mode}
      data-match-mode={props.matchMode ?? '1v1'}
      style={{ position: 'relative', width: '100%' }}
    >
      {/* DOM probes for e2e — visual text is on the WebGL card texture */}
      <span data-testid="gc-opponent-identity-text" hidden>
        {opponentCardText}
      </span>
      <span data-testid="gc-self-identity-text" hidden>
        {selfCardText}
      </span>

      <div className="gc-real3d-canvas-shell">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{
            position: cameraPositionForSeat(props.matchMode, props.selfSeat),
            fov: CAMERA_FOV,
            near: 0.15,
            far: 40,
          }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.setClearColor('#2e1065');
          }}
          onError={(error) => {
            console.error('[guessing-challenge] Canvas render error', error);
            setCanvasFailed(true);
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <Suspense fallback={null}>
            <SceneContent props={props} reduceMotion={reduceMotion} onLookReady={onLookReady} />
          </Suspense>
        </Canvas>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3 px-2 pb-1">
        <button
          type="button"
          onClick={() => look?.recenter()}
          className="shrink-0 rounded-xl border border-orange-400/35 bg-violet-950/70 px-3 py-2 text-xs font-semibold leading-5 text-orange-100"
          data-testid="gc-recenter-camera"
        >
          إعادة توسيط النظر
        </button>
        {props.mode === 'playing' && props.turnTitle ? (
          <div
            className="min-w-0 max-w-[min(100%,18rem)] overflow-visible rounded-xl border border-orange-400/25 bg-violet-950/70 px-3.5 py-2 text-right shadow-sm"
            data-testid="gc-turn-indicator"
            dir="rtl"
          >
            <p className="text-xs font-semibold leading-5 break-words text-orange-100">
              {props.turnTitle}
            </p>
            {props.turnInstruction ? (
              <p className="mt-0.5 text-[0.7rem] leading-4 break-words text-violet-100/85">
                {props.turnInstruction}
              </p>
            ) : null}
            {props.yellowQuestionsRemaining != null ? (
              <p className="mt-0.5 text-[0.7rem] font-semibold leading-4 text-amber-200">
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
