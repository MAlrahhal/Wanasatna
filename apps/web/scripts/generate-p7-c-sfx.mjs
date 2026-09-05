/**
 * Local original SFX generator. No ffmpeg / npm audio packages.
 * 16-bit PCM WAV, 22050 Hz mono.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '../public/audio/sfx');
mkdirSync(outDir, { recursive: true });

function env(t, attack, decay) {
  if (t < attack) {
    return t / attack;
  }
  return Math.exp(-3.2 * ((t - attack) / Math.max(decay, 0.001)));
}

function tone(freq, durationMs, { attack = 0.008, gain = 0.55, slide = 0 } = {}) {
  const n = Math.floor((RATE * durationMs) / 1000);
  const decay = durationMs / 1000 - attack;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / RATE;
    const f = freq + slide * t;
    samples[i] = Math.sin(2 * Math.PI * f * t) * env(t, attack, decay) * gain;
  }
  return samples;
}

function concat(parts, gapMs = 12) {
  const gap = Math.floor((RATE * gapMs) / 1000);
  let total = 0;
  for (const part of parts) {
    total += part.length + gap;
  }
  const out = new Float32Array(total);
  let o = 0;
  for (const part of parts) {
    out.set(part, o);
    o += part.length + gap;
  }
  return out;
}

function writeWav(name, samples) {
  let last = samples.length - 1;
  while (last > 0 && Math.abs(samples[last]) < 0.002) {
    last -= 1;
  }
  const trimmed = samples.subarray(0, last + 1);
  const dataSize = trimmed.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < trimmed.length; i += 1) {
    const v = Math.max(-1, Math.min(1, trimmed[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  const path = join(outDir, `${name}.wav`);
  writeFileSync(path, buf);
  return { name, bytes: buf.length };
}

const written = [
  writeWav(
    'go',
    concat([
      tone(392, 90, { gain: 0.5 }),
      tone(523, 130, { gain: 0.58 }),
    ]),
  ),
  writeWav(
    'your-turn',
    concat([
      tone(494, 90, { gain: 0.48 }),
      tone(587, 140, { gain: 0.55 }),
    ]),
  ),
  writeWav('wrong', tone(349, 200, { gain: 0.48, slide: -90 })),
  writeWav('time-up', tone(311, 360, { attack: 0.012, gain: 0.52, slide: -40 })),
  writeWav(
    'match-win',
    concat([
      tone(523, 120, { gain: 0.55 }),
      tone(659, 120, { gain: 0.58 }),
      tone(784, 140, { gain: 0.6 }),
      tone(1046, 280, { gain: 0.62 }),
    ], 14),
  ),
  writeWav('notify', tone(880, 160, { attack: 0.006, gain: 0.4 })),
];

console.log(JSON.stringify(written, null, 2));
console.log(
  'totalKB',
  (written.reduce((sum, item) => sum + item.bytes, 0) / 1024).toFixed(1),
);
