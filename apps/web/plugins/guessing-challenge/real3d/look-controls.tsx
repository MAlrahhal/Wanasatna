'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const DEFAULT_YAW_LIMIT = (38 * Math.PI) / 180;
const DEFAULT_PITCH_LIMIT = (18 * Math.PI) / 180;
const SENSITIVITY = 0.0032;
const DAMPING = 0.14;
const LOOK_EMIT_MS = 100;

export type LookControlsHandle = {
  recenter: () => void;
};

type LookControlsProps = {
  enabled?: boolean;
  reduceMotion?: boolean;
  /** Absolute yaw limit in radians (default ~38°). */
  yawLimit?: number;
  /** Absolute pitch limit in radians (default ~18°). */
  pitchLimit?: number;
  onReady?: (handle: LookControlsHandle) => void;
  /** Normalized look in -1..1 relative to limits. Throttled ~100ms. */
  onLookChange?: (yaw: number, pitch: number) => void;
};

/**
 * Click/touch-drag seated head look. No pointer lock, no locomotion.
 */
export function LookControls({
  enabled = true,
  reduceMotion = false,
  yawLimit = DEFAULT_YAW_LIMIT,
  pitchLimit = DEFAULT_PITCH_LIMIT,
  onReady,
  onLookChange,
}: LookControlsProps) {
  const { camera, gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0);
  const targetYaw = useRef(0);
  const targetPitch = useRef(0);
  const dragging = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const yawLimitRef = useRef(yawLimit);
  const pitchLimitRef = useRef(pitchLimit);
  const onLookChangeRef = useRef(onLookChange);
  const lastEmit = useRef(0);
  const lastEmitted = useRef({ yaw: 0, pitch: 0 });

  yawLimitRef.current = yawLimit;
  pitchLimitRef.current = pitchLimit;
  onLookChangeRef.current = onLookChange;

  useEffect(() => {
    onReady?.({
      recenter: () => {
        targetYaw.current = 0;
        targetPitch.current = 0;
        if (reduceMotion) {
          yaw.current = 0;
          pitch.current = 0;
        }
      },
    });
  }, [onReady, reduceMotion]);

  useEffect(() => {
    const element = gl.domElement;

    const onPointerDown = (event: PointerEvent) => {
      if (!enabled) return;
      dragging.current = true;
      last.current = { x: event.clientX, y: event.clientY };
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // ignore capture failures on older browsers
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!enabled || !dragging.current || !last.current) return;
      const dx = event.clientX - last.current.x;
      const dy = event.clientY - last.current.y;
      last.current = { x: event.clientX, y: event.clientY };

      targetYaw.current = THREE.MathUtils.clamp(
        targetYaw.current - dx * SENSITIVITY,
        -yawLimitRef.current,
        yawLimitRef.current,
      );
      targetPitch.current = THREE.MathUtils.clamp(
        targetPitch.current - dy * SENSITIVITY,
        -pitchLimitRef.current,
        pitchLimitRef.current,
      );
    };

    const endDrag = (event: PointerEvent) => {
      dragging.current = false;
      last.current = null;
      if (element.hasPointerCapture?.(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
    };

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', endDrag);
    element.addEventListener('pointercancel', endDrag);

    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', endDrag);
      element.removeEventListener('pointercancel', endDrag);
    };
  }, [enabled, gl]);

  useFrame(() => {
    if (reduceMotion) {
      yaw.current = targetYaw.current;
      pitch.current = targetPitch.current;
    } else {
      yaw.current += (targetYaw.current - yaw.current) * DAMPING;
      pitch.current += (targetPitch.current - pitch.current) * DAMPING;
    }

    // Stored +pitch = look up; Three.js +rot.x looks down, so negate on apply.
    euler.current.set(-pitch.current, yaw.current, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler.current);

    const cb = onLookChangeRef.current;
    if (!cb) return;

    const yLim = yawLimitRef.current || 1;
    const pLim = pitchLimitRef.current || 1;
    const nYaw = THREE.MathUtils.clamp(yaw.current / yLim, -1, 1);
    const nPitch = THREE.MathUtils.clamp(pitch.current / pLim, -1, 1);
    const now = performance.now();
    const changed =
      Math.abs(nYaw - lastEmitted.current.yaw) > 0.01 ||
      Math.abs(nPitch - lastEmitted.current.pitch) > 0.01;

    if (changed && now - lastEmit.current >= LOOK_EMIT_MS) {
      lastEmit.current = now;
      lastEmitted.current = { yaw: nYaw, pitch: nPitch };
      cb(nYaw, nPitch);
    }
  });

  return null;
}
