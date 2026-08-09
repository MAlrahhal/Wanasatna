'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const YAW_LIMIT = (38 * Math.PI) / 180;
const PITCH_LIMIT = (18 * Math.PI) / 180;
const SENSITIVITY = 0.0032;
const DAMPING = 0.14;

export type LookControlsHandle = {
  recenter: () => void;
};

type LookControlsProps = {
  enabled?: boolean;
  reduceMotion?: boolean;
  onReady?: (handle: LookControlsHandle) => void;
};

/**
 * Click/touch-drag seated head look. No pointer lock, no locomotion.
 */
export function LookControls({
  enabled = true,
  reduceMotion = false,
  onReady,
}: LookControlsProps) {
  const { camera, gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0);
  const targetYaw = useRef(0);
  const targetPitch = useRef(0);
  const dragging = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));

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
        -YAW_LIMIT,
        YAW_LIMIT,
      );
      targetPitch.current = THREE.MathUtils.clamp(
        targetPitch.current - dy * SENSITIVITY,
        -PITCH_LIMIT,
        PITCH_LIMIT,
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

    euler.current.set(pitch.current, yaw.current, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler.current);
  });

  return null;
}
