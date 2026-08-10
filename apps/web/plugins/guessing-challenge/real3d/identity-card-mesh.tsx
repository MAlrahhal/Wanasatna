'use client';

import { useEffect, useState } from 'react';
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

function buildCardTexture(
  text: string,
  label: string | undefined,
  highlight: boolean,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  ctx.fillStyle = highlight ? '#ecfdf5' : '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = highlight ? '#86efac' : '#cbd5e1';
  ctx.lineWidth = 14;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  ctx.fillStyle = highlight ? '#14532d' : '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';

  if (label) {
    ctx.font = '600 28px Segoe UI, Tahoma, Arial, sans-serif';
    ctx.globalAlpha = 0.55;
    ctx.fillText(label, canvas.width / 2, 78);
    ctx.globalAlpha = 1;
  }

  const mainSize =
    text === '؟؟؟' ? 120 : Math.min(96, Math.floor(420 / Math.max(1, text.length * 0.55)));
  ctx.font = '800 ' + String(mainSize) + 'px Segoe UI, Tahoma, Arial, sans-serif';
  ctx.fillText(text || '-', canvas.width / 2, label ? 200 : 180);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Physical white identity card — identity word painted ON the card face.
 * Drei Html+transform was blank in production (occlusion / nested transforms).
 * Unlit canvas texture on both faces so lighting cannot wash the word out.
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
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const next = buildCardTexture(text, label, highlight);
    setTexture(next);
    return () => {
      next.dispose();
    };
  }, [text, label, highlight, flipKey]);

  const faceW = width * 0.92;
  const faceH = height * 0.88;
  const faceZ = 0.0155;

  return (
    <group userData={{ testId, identityText: text, flipKey }}>
      <mesh castShadow>
        <boxGeometry args={[width, height, 0.028]} />
        <meshStandardMaterial
          color={highlight ? '#ecfdf5' : '#f1f5f9'}
          roughness={0.7}
          metalness={0.04}
        />
      </mesh>
      {/* Front face (+Z) — primary camera view */}
      <mesh position={[0, 0, faceZ]} name={testId}>
        <planeGeometry args={[faceW, faceH]} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color={highlight ? '#ecfdf5' : '#f8fafc'} />
        )}
      </mesh>
      {/* Back face (−Z) — if card tilts away, word still reads */}
      <mesh position={[0, 0, -faceZ]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[faceW, faceH]} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color={highlight ? '#ecfdf5' : '#f8fafc'} />
        )}
      </mesh>
    </group>
  );
}
