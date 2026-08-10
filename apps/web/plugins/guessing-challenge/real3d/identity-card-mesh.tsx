'use client';

import { useLayoutEffect, useState } from 'react';
import * as THREE from 'three';

export type IdentityCardMeshProps = {
  text: string;
  /** When true, face stays blank (no identity / no ؟؟؟). */
  blank?: boolean;
  label?: string;
  highlight?: boolean;
  width?: number;
  height?: number;
  flipKey?: string;
  reduceMotion?: boolean;
  testId?: string;
};

/** Prefer game Arabic face when available (IBM Plex via --font-ibm-plex-arabic). */
function resolveFontStack(): string {
  if (typeof document === 'undefined') {
    return '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif';
  }
  const cssFont = getComputedStyle(document.documentElement)
    .getPropertyValue('--font-ibm-plex-arabic')
    .trim();
  const family = cssFont || '"IBM Plex Sans Arabic"';
  return `${family}, "Segoe UI", Tahoma, Arial, sans-serif`;
}

function fitFontSize(text: string, maxPx: number, minPx: number): number {
  const len = Math.max(1, Array.from(text).length);
  // Longer Arabic phrases scale down; keep padding from borders.
  const scaled = Math.floor(720 / (len * 0.55));
  return Math.max(minPx, Math.min(maxPx, scaled));
}

function paintCard(
  canvas: HTMLCanvasElement,
  text: string,
  label: string | undefined,
  highlight: boolean,
  blank: boolean,
): void {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    return;
  }

  const w = canvas.width;
  const h = canvas.height;
  const fontStack = resolveFontStack();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = highlight ? '#ecfdf5' : '#ffffff';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = highlight ? '#16a34a' : '#64748b';
  ctx.lineWidth = 22;
  ctx.strokeRect(20, 20, w - 40, h - 40);

  if (blank) {
    return;
  }

  const display = text.trim();
  if (!display) {
    return;
  }

  ctx.fillStyle = highlight ? '#14532d' : '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';

  if (label) {
    ctx.font = `600 36px ${fontStack}`;
    ctx.globalAlpha = 0.5;
    ctx.fillText(label, w / 2, 88);
    ctx.globalAlpha = 1;
  }

  const size = fitFontSize(display, 220, 72);
  ctx.font = `800 ${size}px ${fontStack}`;
  // Soft shadow for contrast on white face
  ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 2;
  ctx.fillText(display, w / 2, label ? 250 : h / 2 + 8);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function createTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 720;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Physical identity card — high-contrast Arabic word painted ON the face.
 */
export function IdentityCardMesh({
  text,
  blank = false,
  label,
  highlight = false,
  width = 0.55,
  height = 0.38,
  flipKey = '',
  testId = 'gc-identity-card-mesh',
}: IdentityCardMeshProps) {
  const [texture] = useState(() => (typeof document !== 'undefined' ? createTexture() : null));
  const display = blank ? '' : (text || '').trim();
  const paintKey = `${display}|${label ?? ''}|${highlight}|${blank}|${flipKey}`;

  useLayoutEffect(() => {
    if (!texture) {
      return;
    }
    const canvas = texture.image as HTMLCanvasElement;
    const run = () => {
      paintCard(canvas, display, label, highlight, blank);
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
  }, [texture, paintKey, display, label, highlight, blank]);

  useLayoutEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  const faceColor = highlight ? '#ecfdf5' : '#ffffff';
  const faceW = width * 0.94;
  const faceH = height * 0.9;

  return (
    <group userData={{ testId, identityText: display, blank, flipKey }}>
      <mesh>
        <boxGeometry args={[width, height, 0.024]} />
        <meshBasicMaterial color={faceColor} />
      </mesh>
      <mesh position={[0, 0, 0.013]} name={testId} userData={{ testId, identityText: display, blank }}>
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
