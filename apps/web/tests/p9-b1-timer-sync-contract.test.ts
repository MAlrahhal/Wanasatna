/**
 * P9-B.1: PHASE_CHANGED still full-syncs; countdown uses deadlineAtMs locally.
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

function readHook(plugin: string): string {
  return readFileSync(join(root, 'plugins', plugin, 'use-player-view.ts'), 'utf8');
}

const plugins = [
  { id: 'bara-al-salafa', event: 'BARA_AL_SALAFA_PHASE_CHANGED_EVENT' },
  { id: 'draw-guess', event: 'DRAW_GUESS_PHASE_CHANGED_EVENT' },
  { id: 'imposter-draw', event: 'IMPOSTER_DRAW_PHASE_CHANGED_EVENT' },
  { id: 'fast-answer', event: 'FAST_ANSWER_PHASE_CHANGED_EVENT' },
  { id: 'who-wrote-it', event: 'WHO_WROTE_IT_PHASE_CHANGED_EVENT' },
  { id: 'judge', event: 'JUDGE_PHASE_CHANGED_EVENT' },
  { id: 'guessing-challenge', event: 'GUESSING_CHALLENGE_PHASE_CHANGED_EVENT' },
  { id: 'timing-challenge', event: 'TIMING_CHALLENGE_PHASE_CHANGED_EVENT' },
] as const;

for (const plugin of plugins) {
  test(`${plugin.id}: PHASE_CHANGED still syncs and cleans up`, () => {
    const hook = readHook(plugin.id);
    assert.match(hook, new RegExp(`socket\\.on\\(${plugin.event},\\s*onPhaseChanged\\)`));
    assert.match(hook, /void syncView\(\)/);
    assert.match(hook, new RegExp(`socket\\.off\\(${plugin.event},\\s*onPhaseChanged\\)`));
    assert.doesNotMatch(hook, /setInterval\(updateRemaining,\s*250\)/);
    assert.doesNotMatch(hook, /setRemainingSeconds/);
  });
}

test('fast-answer also falls back to questionDeadlineAtMs', () => {
  const hook = readHook('fast-answer');
  assert.match(hook, /view\.deadlineAtMs \?\? view\.questionDeadlineAtMs/);
});

test('display clock ticks inside use-deadline-clock, not plugin hooks', () => {
  const clock = readFileSync(join(root, 'lib/game/use-deadline-clock.ts'), 'utf8');
  assert.match(clock, /setInterval\(update, intervalMs\)/);
  assert.match(clock, /clearInterval\(intervalId\)/);
  assert.match(clock, /remainingSecondsFromDeadline/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
