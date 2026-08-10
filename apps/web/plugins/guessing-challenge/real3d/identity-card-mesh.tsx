'use client';

import { useLayoutEffect, useState } from 'react';
import * as THREE from 'three';

export type IdentityCardMeshProps = {
  text: string;
  label?: string;
  highlight?: boolean;
  width?: number;
  height?: number;
  flipKey?: string;
  reduceMotion?: boolean;
  testId?: string;
};

const FONT_STACK =
  '"Segoe UI", "Noto Naskh Arabic", "Noto Sans Arabic", Tahoma, Arial, sans-serif';

function paintCard(
  canvas: HTMLCanvasElement,
  text: string,
  label: string | undefined,
  highlight: boolean,
): void {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    return;
  }

  const w = canvas.width;
  const h = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = highlight ? '#ecfdf5' : '#ffffff';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = highlight ? '#22c55e' : '#94a3b8';
  ctx.lineWidth = 16;
  ctx.strokeRect(14, 14, w - 28, h - 28);

  ctx.fillStyle = highlight ? '#14532d' : '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (label) {
    ctx.font = `600 30px ${FONT_STACK}`;
    ctx.globalAlpha = 0.55;
    ctx.direction = 'rtl';
    ctx.fillText(label, w / 2, 70);
    ctx.globalAlpha = 1;
  }

  const display = text.trim() || '؟؟؟';
  const size =
    display === '؟؟؟' ? 150 : Math.min(120, Math.floor(500 / Math.max(1, display.length * 0.5)));
  ctx.font = `800 ${size}px ${FONT_STACK}`;
  ctx.direction = 'rtl';
  ctx.fillText(display, w / 2, label ? 205 : 185);
}

function createTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 360;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Physical identity card — word painted ON the face via CanvasTexture.
 * (Drei Html was clipped / flipped / RTL-offset in the real browser.)
 */
export function IdentityCardMesh({
  text,
  label,
  highlight = false,
  width = 0.55,
  height = 0.38,
  flipKey = '',
  testId = 'gc-identity-card-mesh',
}: IdentityCardMeshProps) {
  const [texture] = useState(() => (typeof document !== 'undefined' ? createTexture() : null));
  const display = (text || '').trim() || '؟؟؟';
  const paintKey = `${display}|${label ?? ''}|${highlight}|${flipKey}`;

  useLayoutEffect(() => {
    if (!texture) {
      return;
    }
    const canvas = texture.image as HTMLCanvasElement;
    const run = () => {
      paintCard(canvas, display, label, highlight);
      texture.needsUpdate = true;
    };
    run();
    const fonts = typeof document !== 'undefined' ? document.fonts?.ready : null;
    let raf = 0;
    if (fonts) {
      void fonts.then(() => {
        run();
        raf = window.requestAnimationFrame(run);
      });
    } else {
      raf = window.requestAnimationFrame(run);
    }
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [texture, paintKey, display, label, highlight]);

  useLayoutEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  const faceColor = highlight ? '#ecfdf5' : '#ffffff';
  const faceW = width * 0.94;
  const faceH = height * 0.9;

  return (
    <group userData={{ testId, identityText: display, flipKey }}>
      <mesh>
        <boxGeometry args={[width, height, 0.024]} />
        <meshBasicMaterial color={faceColor} />
      </mesh>
      <mesh position={[0, 0, 0.013]} name={testId} userData={{ testId, identityText: display }}>
        <planeGeometry args={[faceW, faceH]} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color={faceColor} />
        )}
      </mesh>
      <mesh position={[0, 0, -0.013]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[faceW, faceH]} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color={faceColor} />
        )}
      </mesh>
    </group>
  );
}
