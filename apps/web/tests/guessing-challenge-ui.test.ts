/**
 * Focused web checks for Guessing Challenge catalog + first-person UI structure.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { mockLobbyGames } from '@/lib/lobby/mock-games';
import { getHomeGameShowcase } from '@/lib/home/game-showcase';
import { getGameRoundCategories } from '@/lib/game/round-categories/registry';
import { resolveIdentityCardText } from '../plugins/guessing-challenge/identity-display';

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

function readPlugin(relativePath: string): string {
  return readFileSync(join(root, 'plugins/guessing-challenge', relativePath), 'utf8');
}

test('catalog card exists and marks 2 players', () => {
  const entry = getGameCatalogEntry('guessing-challenge');
  assert.equal(entry.availability, 'available');
  assert.equal(entry.playerRange, 'لاعبان');
  assert.equal(entry.featured, true);

  const lobby = mockLobbyGames.find((game) => game.id === 'guessing-challenge');
  assert.ok(lobby);
  assert.equal(lobby.title, 'تحدي التخمين');
  assert.equal(getHomeGameShowcase('guessing-challenge').availability, 'available');
});

test('round categories include random and football', () => {
  const config = getGameRoundCategories('guessing-challenge');
  assert.ok(config);
  assert.ok(config.categories.some((category) => category.id === 'random'));
  assert.ok(config.categories.some((category) => category.id === 'football'));
});

test('A/B identity helper: own hidden, opponent visible text', () => {
  assert.equal(resolveIdentityCardText(null, true), '؟؟؟');
  assert.equal(
    resolveIdentityCardText({ type: 'text', value: 'بطريق', imageUrl: null }, false),
    'بطريق',
  );
});

test('C/D/E/F/G playing screen wires first-person scene + controls', () => {
  const playing = readPlugin('playing-screen.tsx');
  const scene = readPlugin('first-person-game-scene.tsx');
  const special = readPlugin('special-card-button.tsx');

  assert.match(playing, /FirstPersonGameScene/);
  assert.match(playing, /selfHidden/);
  assert.match(playing, /opponentIdentity=\{view\.opponent\.visibleIdentity\}/);
  assert.match(playing, /opponentName=\{view\.opponent\.name\}/);
  assert.match(playing, /turnTitle/);
  assert.match(playing, /gc-end-question/);
  assert.match(playing, /gc-open-guess/);
  assert.match(playing, /gc-final-guess-panel/);
  assert.match(playing, /yellowAvailable=\{view\.self\.yellowCardAvailable\}/);
  assert.match(playing, /redAvailable=\{view\.self\.redCardAvailable\}/);
  assert.match(playing, /canUseYellow=\{view\.canUseYellow\}/);
  assert.match(playing, /canUseRed=\{view\.canUseRed\}/);

  assert.match(scene, /gc-first-person-scene/);
  assert.match(scene, /gc-opponent-identity/);
  assert.match(scene, /gc-self-identity/);
  assert.match(scene, /SpecialCardButton/);
  assert.match(scene, /variant="yellow"/);
  assert.match(scene, /variant="red"/);
  assert.match(scene, /gc-fp-table/);
  assert.match(special, /gc-yellow-card/);
  assert.match(special, /gc-red-card/);
  assert.match(special, /تم الاستخدام/);
  assert.doesNotMatch(playing, /VS/);
  assert.doesNotMatch(playing, /CharacterFigure name=\{view\.self\.name\}/);
});

test('H reveal screen uses same scene with both identities', () => {
  const results = readPlugin('round-results-screen.tsx');
  assert.match(results, /FirstPersonGameScene/);
  assert.match(results, /mode="reveal"/);
  assert.match(results, /selfIdentity=\{selfReveal\?\.identity/);
  assert.match(results, /opponentIdentity=\{opponentReveal\?\.identity/);
  assert.match(results, /showSpecialCards=\{false\}/);
  assert.doesNotMatch(results, />\s*VS\s*</);
});

test('I mobile/perspective CSS keeps controls outside transforms', () => {
  const css = readPlugin('first-person-scene.css');
  const playing = readPlugin('playing-screen.tsx');
  assert.match(css, /perspective:/);
  assert.match(css, /@media \(min-width: 640px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(playing, /gc-primary-actions/);
  assert.match(playing, /FirstPersonGameScene/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
