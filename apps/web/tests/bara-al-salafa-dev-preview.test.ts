/**
 * Dev preview module smoke test (no Socket.IO, no browser).
 * Run from apps/web via test:unit.
 */
import assert from 'node:assert/strict';
import { BaraAlSalafaDevPreviewClient } from '@/components/dev/bara-al-salafa-dev-preview-client';
import {
  directedQuestionsDemoDefaults,
  roleRevealDemoDefaults,
  roundResultsCorrectDemoDefaults,
} from '@/plugins/bara-al-salafa/role-reveal-demo-data';

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

test('demo data exports required props for dev preview screens', () => {
  assert.ok(roleRevealDemoDefaults.secretWord);
  assert.ok(directedQuestionsDemoDefaults.askerPlayerId);
  assert.ok(roundResultsCorrectDemoDefaults.roundResults.length > 0);
});

test('dev preview client component is exported for /dev/bara-al-salafa route', () => {
  assert.equal(typeof BaraAlSalafaDevPreviewClient, 'function');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
