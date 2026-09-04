/**
 * Timing Challenge UI helpers — digital format + start/end-sound transition rules.
 * Run via web test:unit (appended) or:
 * node ../server/node_modules/tsx/dist/cli.mjs tests/timing-challenge-ui.test.ts
 */
import assert from 'node:assert/strict';
import { formatDigitalTimer, formatSecondsFromMs } from '../plugins/timing-challenge/format';
import {
  shouldPlayTimingEndSound,
  shouldPlayTimingStartSound,
  timingEndEventKey,
  type TimingWindowSfxSnapshot,
} from '../plugins/timing-challenge/timing-window-sfx';

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

function snap(
  partial: Partial<TimingWindowSfxSnapshot> & Pick<TimingWindowSfxSnapshot, 'phase' | 'mode'>,
): TimingWindowSfxSnapshot {
  return {
    round: 1,
    running: false,
    ...partial,
  };
}

test('F/H digital timer formats MM:SS.cc without exposing raw ms as integer', () => {
  assert.equal(formatDigitalTimer(7350), '00:07.35');
  assert.equal(formatDigitalTimer(0), '00:00.00');
  assert.equal(formatDigitalTimer(61_020), '01:01.02');
  assert.equal(formatSecondsFromMs(7350), '7.35');
});

test('A Mode A plays once on ready → hidden-timing', () => {
  assert.equal(
    shouldPlayTimingStartSound(
      snap({ phase: 'ready', mode: 'guess-time' }),
      snap({ phase: 'hidden-timing', mode: 'guess-time' }),
    ),
    true,
  );
});

test('B Mode A rerender / same phase does not replay', () => {
  assert.equal(
    shouldPlayTimingStartSound(
      snap({ phase: 'hidden-timing', mode: 'guess-time' }),
      snap({ phase: 'hidden-timing', mode: 'guess-time' }),
    ),
    false,
  );
});

test('C next round plays again on ready → hidden-timing', () => {
  assert.equal(
    shouldPlayTimingStartSound(
      snap({ round: 2, phase: 'ready', mode: 'guess-time' }),
      snap({ round: 2, phase: 'hidden-timing', mode: 'guess-time' }),
    ),
    true,
  );
});

test('D reconnect mount into running timer does not play', () => {
  assert.equal(
    shouldPlayTimingStartSound(null, snap({ phase: 'hidden-timing', mode: 'guess-time' })),
    false,
  );
});

test('Mode B plays once when self timer starts', () => {
  assert.equal(
    shouldPlayTimingStartSound(
      snap({ phase: 'stop-timer', mode: 'stop-timer', running: false }),
      snap({ phase: 'stop-timer', mode: 'stop-timer', running: true }),
    ),
    true,
  );
});

test('Mode A end sound on hidden-timing → guessing', () => {
  assert.equal(
    shouldPlayTimingEndSound(
      snap({ phase: 'hidden-timing', mode: 'guess-time' }),
      snap({ phase: 'guessing', mode: 'guess-time' }),
    ),
    true,
  );
});

test('Mode A end sound does not replay on guessing rerender', () => {
  assert.equal(
    shouldPlayTimingEndSound(
      snap({ phase: 'guessing', mode: 'guess-time' }),
      snap({ phase: 'guessing', mode: 'guess-time' }),
    ),
    false,
  );
});

test('Mode A guessing → round-results is not a timing-window end', () => {
  assert.equal(
    shouldPlayTimingEndSound(
      snap({ phase: 'guessing', mode: 'guess-time' }),
      snap({ phase: 'round-results', mode: 'guess-time' }),
    ),
    false,
  );
});

test('reconnect into guessing does not play end sound', () => {
  assert.equal(
    shouldPlayTimingEndSound(null, snap({ phase: 'guessing', mode: 'guess-time' })),
    false,
  );
});

test('Mode B end sound when the local timer stops', () => {
  assert.equal(
    shouldPlayTimingEndSound(
      snap({ phase: 'stop-timer', mode: 'stop-timer', running: true }),
      snap({ phase: 'stop-timer', mode: 'stop-timer', running: false }),
    ),
    true,
  );
});

test('Mode B start transition does not play end sound', () => {
  assert.equal(
    shouldPlayTimingEndSound(
      snap({ phase: 'stop-timer', mode: 'stop-timer', running: false }),
      snap({ phase: 'stop-timer', mode: 'stop-timer', running: true }),
    ),
    false,
  );
});

test('end eventKey is stable per round so stop + phase-leave cannot double-play', () => {
  assert.equal(timingEndEventKey('round-a'), timingEndEventKey('round-a'));
  assert.notEqual(timingEndEventKey('round-a'), timingEndEventKey('round-b'));
});

test('global doodle pattern CSS var opacity restored above invisible threshold', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const css = readFileSync(join(__dirname, '..', 'styles', 'game-theme.css'), 'utf8');
  assert.match(css, /opacity='0\.12'/);
  assert.match(css, /\.wanas-site-bg-pattern/);
  assert.match(css, /pointer-events:\s*none/);
});

test('root layout mounts global background layer', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const layout = readFileSync(join(__dirname, '..', 'app', 'layout.tsx'), 'utf8');
  assert.match(layout, /wanas-site-bg-pattern/);
});

test('original go SFX exists and temp timer-start WAV is gone', async () => {
  const { existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  assert.equal(existsSync(join(__dirname, '..', 'public', 'audio', 'sfx', 'go.wav')), true);
  assert.equal(existsSync(join(__dirname, '..', 'public', 'sounds', 'timer-start.wav')), false);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
