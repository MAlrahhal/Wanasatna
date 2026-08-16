/**
 * P9-B.3: countdown display ticks stay inside timer UI, not GameScreen/meta.
 * Limitation: this is a source/contract test, not a React render-count profiler.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

function remainingSecondsFromDeadline(deadlineAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadlineAtMs - nowMs) / 1000));
}

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

const plugins = [
  'bara-al-salafa',
  'draw-guess',
  'imposter-draw',
  'fast-answer',
  'who-wrote-it',
  'judge',
  'guessing-challenge',
  'timing-challenge',
] as const;

test('reconnect remaining time derives from absolute deadline', () => {
  const clock = read('lib/game/deadline-clock.ts');
  assert.match(
    clock,
    /Math\.max\(0, Math\.ceil\(\(deadlineAtMs - nowMs\) \/ 1000\)\)/,
  );
  const start = 1_700_000_000_000;
  const durationMs = 10_000;
  const deadline = start + durationMs;
  assert.equal(remainingSecondsFromDeadline(deadline, start), 10);
  assert.equal(remainingSecondsFromDeadline(deadline, start + 5_000), 5);
  assert.equal(remainingSecondsFromDeadline(deadline, start + 9_400), 1);
  assert.equal(remainingSecondsFromDeadline(deadline, start + 10_000), 0);
  assert.equal(remainingSecondsFromDeadline(deadline, start + 12_000), 0);
});

test('deadline change recomputes remaining without decrement counters', () => {
  const now = 1_700_000_000_000;
  assert.equal(remainingSecondsFromDeadline(now + 8_000, now), 8);
  assert.equal(remainingSecondsFromDeadline(now + 3_000, now), 3);
  const clock = read('lib/game/use-deadline-clock.ts');
  assert.doesNotMatch(clock, /remaining\s*-=\s*1/);
  assert.match(clock, /remainingSecondsFromDeadline\(deadlineAtMs\)/);
});

test('use-deadline-clock cleans up interval on unmount/deadline change', () => {
  const clock = read('lib/game/use-deadline-clock.ts');
  assert.match(clock, /window\.setInterval\(update, intervalMs\)/);
  assert.match(clock, /return \(\) => \{\s*window\.clearInterval\(intervalId\);\s*\}/);
  assert.match(clock, /\[deadlineAtMs, intervalMs\]/);
});

test('time-up sfx ticks via refs, not parent remainingSeconds state', () => {
  const sfx = read('lib/game/use-deadline-time-up-sfx.ts');
  assert.match(sfx, /playGameSound\('time-up'/);
  assert.match(sfx, /previousRemainingRef/);
  assert.doesNotMatch(sfx, /useState/);
  assert.match(sfx, /clearInterval/);
});

test('GameExperience timer meta is stable deadlineAtMs, not ticking remainingSeconds', () => {
  const types = read('lib/game/shell-types.ts');
  assert.match(types, /export type GameExperienceTimer = \{[\s\S]*deadlineAtMs: number;/);
  assert.doesNotMatch(types, /remainingSeconds/);
  const header = read('components/game-experience/game-experience-header.tsx');
  assert.match(header, /DeadlineTimerChip/);
  assert.match(header, /deadlineAtMs=\{meta\.timer\.deadlineAtMs\}/);
});

for (const plugin of plugins) {
  test(`${plugin}: hook does not own a 250ms remainingSeconds clock`, () => {
    const hook = read(`plugins/${plugin}/use-player-view.ts`);
    assert.doesNotMatch(hook, /setInterval\(updateRemaining,\s*250\)/);
    assert.doesNotMatch(hook, /setRemainingSeconds/);
  });

  test(`${plugin}: GameScreen does not push remainingSeconds through experience meta`, () => {
    const game = read(`plugins/${plugin}/game-screen.tsx`);
    assert.doesNotMatch(game, /timer:[\s\S]{0,180}remainingSeconds/);
    assert.match(game, /toExperienceTimer/);
    assert.match(game, /deadlineAtMs/);
  });
}

test('Guessing Challenge playing tree is not passed ticking remainingSeconds', () => {
  const game = read('plugins/guessing-challenge/game-screen.tsx');
  assert.match(game, /<GuessingChallengePlayingScreen/);
  const playingCall = game.slice(game.indexOf('<GuessingChallengePlayingScreen'));
  const playingBlock = playingCall.slice(0, playingCall.indexOf('/>') + 2);
  assert.doesNotMatch(playingBlock, /remainingSeconds/);
  assert.doesNotMatch(playingBlock, /deadlineAtMs/);
});

test('Timing Challenge web plugins never expose hiddenEndsAtMs', () => {
  const files = [
    'plugins/timing-challenge/use-player-view.ts',
    'plugins/timing-challenge/game-screen.tsx',
    'plugins/timing-challenge/use-sfx.ts',
    'lib/game/shell-types.ts',
    'components/game-experience/game-experience-header.tsx',
  ];
  for (const file of files) {
    assert.doesNotMatch(read(file), /hiddenEndsAtMs/);
  }
  const game = read('plugins/timing-challenge/game-screen.tsx');
  assert.match(game, /VISIBLE_TIMER_PHASES/);
  assert.match(game, /ready[\s\S]*round-results[\s\S]*match-completed/);
});

test('GameExperience context is not split into extra providers', () => {
  const ctx = read('contexts/game-experience-context.tsx');
  assert.match(ctx, /export function GameExperienceProvider/);
  assert.doesNotMatch(ctx, /TimerProvider/);
  assert.doesNotMatch(ctx, /remainingSeconds/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
