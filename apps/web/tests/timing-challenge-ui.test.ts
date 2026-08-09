/**
 * Timing Challenge UI helpers — digital format + start-sound transition rules.
 * Run via web test:unit (appended) or:
 * node ../server/node_modules/tsx/dist/cli.mjs tests/timing-challenge-ui.test.ts
 */
import assert from 'node:assert/strict';
import { formatDigitalTimer, formatSecondsFromMs } from '../plugins/timing-challenge/format';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

/** Mirrors useTimingStartSound transition rules (no React / DOM). */
function shouldPlayTimerStart(args: {
  prev: { round: number; phase: string; running: boolean; mode: string } | null;
  next: { round: number; phase: string; running: boolean; mode: string };
}): boolean {
  const { prev, next } = args;

  if (!prev) {
    return false;
  }

  if (
    next.mode === 'guess-time' &&
    next.phase === 'hidden-timing' &&
    prev.round === next.round &&
    prev.phase === 'ready'
  ) {
    return true;
  }

  if (
    next.mode === 'stop-timer' &&
    next.phase === 'stop-timer' &&
    next.running &&
    prev.round === next.round &&
    !prev.running
  ) {
    return true;
  }

  return false;
}

test('F/H digital timer formats MM:SS.cc without exposing raw ms as integer', () => {
  assert.equal(formatDigitalTimer(7350), '00:07.35');
  assert.equal(formatDigitalTimer(0), '00:00.00');
  assert.equal(formatDigitalTimer(61_020), '01:01.02');
  assert.equal(formatSecondsFromMs(7350), '7.35');
});

test('A Mode A plays once on ready → hidden-timing', () => {
  assert.equal(
    shouldPlayTimerStart({
      prev: { round: 1, phase: 'ready', running: false, mode: 'guess-time' },
      next: { round: 1, phase: 'hidden-timing', running: false, mode: 'guess-time' },
    }),
    true,
  );
});

test('B Mode A rerender / same phase does not replay', () => {
  assert.equal(
    shouldPlayTimerStart({
      prev: { round: 1, phase: 'hidden-timing', running: false, mode: 'guess-time' },
      next: { round: 1, phase: 'hidden-timing', running: false, mode: 'guess-time' },
    }),
    false,
  );
});

test('C next round plays again on ready → hidden-timing', () => {
  assert.equal(
    shouldPlayTimerStart({
      prev: { round: 2, phase: 'ready', running: false, mode: 'guess-time' },
      next: { round: 2, phase: 'hidden-timing', running: false, mode: 'guess-time' },
    }),
    true,
  );
});

test('D reconnect mount into running timer does not play', () => {
  assert.equal(
    shouldPlayTimerStart({
      prev: null,
      next: { round: 1, phase: 'hidden-timing', running: false, mode: 'guess-time' },
    }),
    false,
  );
});

test('Mode B plays once when self timer starts', () => {
  assert.equal(
    shouldPlayTimerStart({
      prev: { round: 1, phase: 'stop-timer', running: false, mode: 'stop-timer' },
      next: { round: 1, phase: 'stop-timer', running: true, mode: 'stop-timer' },
    }),
    true,
  );
});

test('global doodle pattern CSS var opacity restored above invisible threshold', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const css = readFileSync(join(__dirname, '..', 'styles', 'game-theme.css'), 'utf8');
  assert.match(css, /opacity='0\.055'/);
  assert.match(css, /\.wanas-site-bg-pattern/);
  assert.match(css, /pointer-events:\s*none/);
});

test('root layout mounts global background layer', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const layout = readFileSync(join(__dirname, '..', 'app', 'layout.tsx'), 'utf8');
  assert.match(layout, /wanas-site-bg-pattern/);
});

test('temporary timer-start asset exists', async () => {
  const { existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  assert.equal(existsSync(join(__dirname, '..', 'public', 'sounds', 'timer-start.wav')), true);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
