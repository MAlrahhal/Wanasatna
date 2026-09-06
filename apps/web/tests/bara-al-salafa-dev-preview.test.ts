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
import { isStaleBaraRoleView } from '@/plugins/bara-al-salafa/stale-round-view';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

test('voting spectators do not mount an actionable VotingScreen', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const game = readFileSync(join(root, 'plugins/bara-al-salafa/game-screen.tsx'), 'utf8');
  assert.match(game, /treatAsSpectator && \(!view \|\| view\.gamePhase === 'description' \|\| view\.gamePhase === 'voting'\)/);
  assert.match(
    game,
    /if \(view\.gamePhase === 'voting'\)[\s\S]*if \(view\.isMatchSpectator\)[\s\S]*<WaitingSpectatorScreen/,
  );
  const votingBranch = game.slice(game.indexOf("if (view.gamePhase === 'voting')"));
  const spectatorReturn = votingBranch.indexOf('WaitingSpectatorScreen');
  const votingScreen = votingBranch.indexOf('<VotingScreen');
  assert.ok(spectatorReturn >= 0 && spectatorReturn < votingScreen);
  assert.match(votingBranch.slice(0, votingScreen), /isMatchSpectator/);
  assert.doesNotMatch(votingBranch.slice(0, spectatorReturn), /onConfirmVote/);
});

test('client round change does not keep the previous round role as current', () => {
  assert.equal(isStaleBaraRoleView(1, null), true);
  assert.equal(
    isStaleBaraRoleView(1, { currentRound: 1, gamePhase: 'round-results' }),
    true,
  );
  assert.equal(
    isStaleBaraRoleView(1, { currentRound: 1, gamePhase: 'description' }),
    true,
  );
  assert.equal(
    isStaleBaraRoleView(1, { currentRound: 2, gamePhase: 'description' }),
    false,
  );
  assert.equal(
    isStaleBaraRoleView(1, { currentRound: 1, gamePhase: 'match-completed' }),
    false,
  );
  assert.equal(isStaleBaraRoleView(null, { currentRound: 1, gamePhase: 'description' }), false);

  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const hook = readFileSync(join(root, 'plugins/bara-al-salafa/use-player-view.ts'), 'utf8');
  assert.match(hook, /currentView\?\.gamePhase === 'round-results'/);
  assert.match(hook, /awaitingRoundFromRef\.current = currentView\.currentRound/);
  assert.match(hook, /isStaleBaraRoleView/);
  assert.match(hook, /setIsLoading\(true\)/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
